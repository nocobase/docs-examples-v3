import { randomUUID } from "node:crypto";
import { access, link, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import type { JobExecutionContext } from "@nocobase/jobs";
import type { ReportPayload } from "../jobs/report-job.js";

const orders = [
  { id: "ORD-1001", customer: "Cedar Books", total: 120 },
  { id: "ORD-1002", customer: "Harbor Supply", total: 75 },
  { id: "ORD-1003", customer: "Maple Market", total: 210 },
] as const;

export function validatePayload(payload: ReportPayload): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(payload.reportId))
    throw new Error(
      "reportId must contain 1–80 letters, digits, hyphens or underscores.",
    );
  if (
    !Number.isInteger(payload.stepMs) ||
    payload.stepMs < 0 ||
    payload.stepMs > 5000
  )
    throw new Error("stepMs must be an integer between 0 and 5000.");
  if (!["none", "first", "always"].includes(payload.failure))
    throw new Error("Unknown failure mode.");
}

/** Fixed input data; the committed CSV is the durable business result. */
export async function generateReport(
  directory: string,
  payload: ReportPayload,
  context: JobExecutionContext,
): Promise<void> {
  validatePayload(payload);
  const { signal, reportProgress, attempt } = context;
  signal.throwIfAborted();
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `${payload.reportId}.csv`);
  try {
    await access(file);
    await reportProgress(100);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const rows = ["orderId,customer,total"];
  for (const [index, order] of orders.entries()) {
    try {
      await setTimeout(payload.stepMs, undefined, { signal });
    } catch (error) {
      // timers rejects with AbortError; the executor recognizes signal.reason.
      if (signal.aborted) throw signal.reason;
      throw error;
    }
    signal.throwIfAborted();
    rows.push(`${order.id},${order.customer},${order.total}`);
    await reportProgress((index + 1) * 30);
    if (
      index === 0 &&
      (payload.failure === "always" ||
        (payload.failure === "first" && attempt === 1))
    )
      throw new Error("Demonstration: report generation failed.");
  }
  const temporary = path.join(
    directory,
    `.${payload.reportId}-${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporary, `${rows.join("\n")}\n`, { flag: "wx" });
    signal.throwIfAborted();
    try {
      // Atomic create-if-absent: repeated jobs do not overwrite the report.
      await link(temporary, file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  await reportProgress(100);
}
