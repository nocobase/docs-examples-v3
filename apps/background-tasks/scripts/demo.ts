import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import type { JobEvent } from "@nocobase/jobs";
import { createApp } from "../server/app.js";
import { reportJobsToken, type ReportJobs } from "../server/reports/service.js";

export async function waitForEvent(
  reports: ReportJobs,
  matches: (event: JobEvent) => boolean,
): Promise<JobEvent> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const event = reports.events.find(matches);
    if (event) return event;
    await setTimeout(10);
  }
  throw new Error("Timed out waiting for a job event.");
}

const scenario = process.argv[2] ?? "manual";
if (
  ![
    "manual",
    "retry",
    "failure",
    "repeat",
    "interval",
    "cron",
    "rules",
    "recovery",
  ].includes(scenario)
)
  throw new Error(
    "Use manual, retry, failure, repeat, interval, cron, rules or recovery.",
  );

// Isolate commands so a previous demo's recurring rules cannot affect this run.
await mkdir("storage/demos", { recursive: true });
const root = await mkdtemp(path.resolve("storage/demos", `${scenario}-`));
console.log(`Demo directory: ${root}`);
let app = await createApp(root, {
  consume: true,
  ...(scenario === "interval" ? { schedule: { every: 200, limit: 2 } } : {}),
  // The production example is daily; this accelerated cron tests the same API.
  ...(scenario === "cron"
    ? { schedule: { cron: "*/1 * * * * *", tz: "UTC", limit: 2 } }
    : {}),
});
const reportFile = path.join(root, "storage/reports/order-summary.csv");
try {
  let reports = app.container.resolve(reportJobsToken);
  if (scenario === "rules") {
    await reports.schedule({
      every: 60_000,
      startDate: new Date(Date.now() + 60_000),
    });
    console.log("Created:", await reports.getSchedule());
    await reports.schedule({ cron: "0 2 * * *", tz: "Asia/Shanghai" });
    assert.equal((await reports.getSchedule())?.options.cron, "0 2 * * *");
    console.log("Updated:", await reports.getSchedule());
    console.log("Removed:", await reports.removeSchedule());
    assert.equal(await reports.getSchedule(), undefined);
  } else if (scenario === "interval" || scenario === "cron") {
    await waitForEvent(
      reports,
      (event) =>
        event.name === "JobEnd" &&
        reports.events.filter((item) => item.name === "JobEnd").length === 2,
    );
    console.log("Completed reports: 2");
    await reports.removeSchedule();
  } else {
    const receipt = await reports.enqueue("order-summary", {
      failure:
        scenario === "retry"
          ? "first"
          : scenario === "failure"
            ? "always"
            : "none",
      stepMs: scenario === "recovery" ? 200 : 30,
    });
    console.log("Accepted:", receipt.jobId);
    if (scenario === "recovery") {
      await waitForEvent(
        reports,
        (event) =>
          event.name === "JobProgress" && event.jobId === receipt.jobId,
      );
      await app.shutdown();
      assert(
        reports.events.some(
          (event) =>
            event.name === "JobError" && event.reason === "interrupted",
        ),
      );
      console.log("Interrupted during shutdown; reopening the same storage.");
      app = await createApp(root);
      reports = app.container.resolve(reportJobsToken);
    }
    const result = await waitForEvent(
      reports,
      (event) =>
        event.jobId === receipt.jobId &&
        (scenario === "failure"
          ? event.name === "JobError" && event.attempt === 3
          : event.name === "JobEnd"),
    );
    console.log(`${result.name}, attempt ${result.attempt}`);
    if (scenario === "repeat") {
      const before = await stat(reportFile);
      const repeated = await reports.enqueue("order-summary");
      await waitForEvent(
        reports,
        (event) => event.name === "JobEnd" && event.jobId === repeated.jobId,
      );
      assert.equal((await stat(reportFile)).ino, before.ino);
      console.log("Two submissions; one unchanged report file.");
    }
    if (scenario !== "failure") console.log(await readFile(reportFile, "utf8"));
    else await assert.rejects(stat(reportFile), { code: "ENOENT" });
  }
  for (const event of reports.events) {
    console.log(
      event.name,
      `attempt=${event.attempt}`,
      "progress" in event ? `progress=${event.progress}` : "",
    );
  }
} finally {
  await app.shutdown();
}
