import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { test, type TestContext } from "node:test";
import { jobExecutorServiceToken } from "@nocobase/app-server/jobs";
import { JobsBackendNotRegisteredError, type JobEvent } from "@nocobase/jobs";
import { createApp } from "../server/app.js";
import { reportJobsToken, type ReportJobs } from "../server/reports/service.js";

async function until(
  reports: ReportJobs,
  predicate: (event: JobEvent) => boolean,
) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const found = reports.events.find(predicate);
    if (found) return found;
    await setTimeout(5);
  }
  throw new Error("Expected event did not arrive.");
}

async function fixture(t: TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), "report-app-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("the real App runs jobs, reports progress and preserves one complete CSV for repeated IDs", async (t) => {
  const root = await fixture(t);
  const app = await createApp(root);
  try {
    const reports = app.container.resolve(reportJobsToken);
    const first = await reports.enqueue("orders", { stepMs: 0 });
    await until(reports, (e) => e.name === "JobEnd" && e.jobId === first.jobId);
    const file = path.join(root, "storage/reports/orders.csv");
    assert.equal(
      await readFile(file, "utf8"),
      "orderId,customer,total\nORD-1001,Cedar Books,120\nORD-1002,Harbor Supply,75\nORD-1003,Maple Market,210\n",
    );
    const before = await stat(file);
    const second = await reports.enqueue("orders", { stepMs: 0 });
    assert.notEqual(first.jobId, second.jobId);
    await until(
      reports,
      (e) => e.name === "JobEnd" && e.jobId === second.jobId,
    );
    assert.equal((await stat(file)).ino, before.ino);
    assert.deepEqual(await readdir(path.dirname(file)), ["orders.csv"]);
    assert.deepEqual(
      reports.events
        .filter((e) => e.name === "JobProgress" && e.jobId === first.jobId)
        .map((e) => (e.name === "JobProgress" ? e.progress : undefined)),
      [30, 60, 90, 100],
    );
    await assert.rejects(reports.enqueue("../escape"));
    await assert.rejects(reports.enqueue("orders", { stepMs: -1 }));
  } finally {
    await app.shutdown();
  }
});

test("first-attempt failure retries; persistent failure exhausts three attempts without a result", async (t) => {
  const root = await fixture(t);
  const app = await createApp(root);
  try {
    const reports = app.container.resolve(reportJobsToken);
    const retry = await reports.enqueue("retry", {
      failure: "first",
      stepMs: 0,
    });
    const done = await until(
      reports,
      (e) => e.name === "JobEnd" && e.jobId === retry.jobId,
    );
    assert.equal(done.attempt, 2);
    const failure = await reports.enqueue("failure", {
      failure: "always",
      stepMs: 0,
    });
    await until(
      reports,
      (e) =>
        e.name === "JobError" && e.jobId === failure.jobId && e.attempt === 3,
    );
    assert.deepEqual(
      reports.events
        .filter((e) => e.name === "JobError" && e.jobId === failure.jobId)
        .map((e) => e.attempt),
      [1, 2, 3],
    );
    await assert.rejects(stat(path.join(root, "storage/reports/failure.csv")), {
      code: "ENOENT",
    });
  } finally {
    await app.shutdown();
  }
  const restarted = await createApp(root);
  try {
    await setTimeout(30);
    assert.equal(restarted.container.resolve(reportJobsToken).events.length, 0);
  } finally {
    await restarted.shutdown();
  }
});

test("graceful shutdown recovers the same interrupted job and rejects later submissions", async (t) => {
  const root = await fixture(t);
  const first = await createApp(root);
  const reports = first.container.resolve(reportJobsToken);
  const receipt = await reports.enqueue("recovery", { stepMs: 100 });
  try {
    await until(reports, (e) => e.name === "JobProgress");
  } finally {
    await first.shutdown();
  }
  assert(
    reports.events.some(
      (e) => e.name === "JobError" && e.reason === "interrupted",
    ),
  );
  await assert.rejects(reports.enqueue("after-close"), /not ready/);
  const second = await createApp(root);
  try {
    const recovered = second.container.resolve(reportJobsToken);
    const done = await until(
      recovered,
      (e) => e.name === "JobEnd" && e.jobId === receipt.jobId,
    );
    assert.equal(done.attempt, 2);
    assert.equal(
      recovered.events.find((e) => e.name === "JobProgress")?.progress,
      30,
    );
  } finally {
    await second.shutdown();
  }
});

test("producer-only setup persists pending work for the next consumer", async (t) => {
  const root = await fixture(t);
  const producer = await createApp(root, { consume: false });
  const reports = producer.container.resolve(reportJobsToken);
  const receipt = await reports.enqueue("producer-only", { stepMs: 0 });
  await producer.shutdown();
  assert.equal(reports.events.length, 0);
  const consumer = await createApp(root);
  try {
    await until(
      consumer.container.resolve(reportJobsToken),
      (e) => e.name === "JobEnd" && e.jobId === receipt.jobId,
    );
  } finally {
    await consumer.shutdown();
  }
});

test("interval and cron rules run through real schedule and job executors", async (t) => {
  for (const schedule of [
    { every: 30, limit: 2 },
    { cron: "*/1 * * * * *", tz: "UTC", limit: 1 },
  ]) {
    const root = await fixture(t);
    const app = await createApp(root, { consume: true, schedule });
    try {
      const reports = app.container.resolve(reportJobsToken);
      await until(
        reports,
        (e) =>
          e.name === "JobEnd" &&
          reports.events.filter((item) => item.name === "JobEnd").length ===
            schedule.limit,
      );
      assert.equal(
        (await readdir(path.join(root, "storage/reports"))).filter((file) =>
          file.endsWith(".csv"),
        ).length,
        schedule.limit,
      );
      await reports.removeSchedule();
      assert.equal(await reports.getSchedule(), undefined);
    } finally {
      await app.shutdown();
    }
  }
});

test("stable names update rules, shutdown preserves them and removal deletes them", async (t) => {
  const root = await fixture(t);
  const first = await createApp(root, { consume: false });
  try {
    const reports = first.container.resolve(reportJobsToken);
    const options = { cron: "0 2 * * *", tz: "Asia/Shanghai" };
    await reports.schedule(options);
    const before = await reports.getSchedule();
    await reports.schedule(options);
    assert.deepEqual(
      (await reports.getSchedule())?.nextRunAt,
      before?.nextRunAt,
    );
    await reports.schedule({ cron: "0 3 * * *", tz: "Asia/Shanghai" });
    assert.equal((await reports.getSchedule())?.options.cron, "0 3 * * *");
    await assert.rejects(reports.schedule({ every: 10, cron: "* * * * *" }));
  } finally {
    await first.shutdown();
  }
  const second = await createApp(root, { consume: false });
  try {
    const reports = second.container.resolve(reportJobsToken);
    assert.equal((await reports.getSchedule())?.options.cron, "0 3 * * *");
    await reports.removeSchedule();
    assert.equal(await reports.getSchedule(), undefined);
  } finally {
    await second.shutdown();
  }
});

test("selecting Redis without its commercial backend fails explicitly", async (t) => {
  const app = await createApp(await fixture(t));
  try {
    app.config.mergeDefaults({ jobs: { redis: { adapter: "redis" } } });
    // The existing service captured its configuration; a separate service tests
    // backend selection itself, without pretending to test Redis integration.
    const { createJobExecutorService } = await import("@nocobase/jobs");
    const service = createJobExecutorService(
      { default: "redis", redis: { adapter: "redis" } },
      { appName: "missing-backend", storagePath: app.paths.storage("unused") },
    );
    try {
      assert.throws(
        () => service.getJobExecutor("reports"),
        JobsBackendNotRegisteredError,
      );
      assert.throws(
        () => service.getScheduleExecutor("reports"),
        JobsBackendNotRegisteredError,
      );
    } finally {
      await service.shutdown();
    }
    assert(app.container.resolve(jobExecutorServiceToken));
  } finally {
    await app.shutdown();
  }
});
