import { createServiceToken } from "@nocobase/service-provider";
import type {
  JobEvent,
  JobExecutor,
  JobReceipt,
  ScheduleExecutor,
  ScheduleJobOption,
} from "@nocobase/jobs";
import { createReportJob, type ReportPayload } from "../jobs/report-job.js";
import { validatePayload } from "./generate.js";

export const reportJobsToken =
  createServiceToken<ReportJobs>("app/report-jobs");
export const scheduleName = "order-summary";

export class ReportJobs {
  readonly events: JobEvent[] = [];
  private jobs?: JobExecutor;
  private ReportJob?: ReturnType<typeof createReportJob>;
  private schedules?: ScheduleExecutor;

  attach(
    jobs: JobExecutor,
    ReportJob: ReturnType<typeof createReportJob>,
    schedules: ScheduleExecutor,
  ): void {
    this.jobs = jobs;
    this.ReportJob = ReportJob;
    this.schedules = schedules;
  }

  record(event: JobEvent): void {
    this.events.push(event);
    // This is a bounded, process-local observation window, not task history.
    if (this.events.length > 1000) this.events.shift();
  }

  async enqueue(
    reportId: string,
    options: Partial<Omit<ReportPayload, "reportId">> = {},
  ): Promise<JobReceipt> {
    const payload: ReportPayload = {
      reportId,
      stepMs: 30,
      failure: "none",
      ...options,
    };
    validatePayload(payload);
    if (!this.jobs || !this.ReportJob)
      throw new Error("Report jobs are not ready.");
    return this.jobs.addJob(new this.ReportJob(payload));
  }

  async schedule(options: ScheduleJobOption) {
    if (!this.schedules) throw new Error("Report schedules are not ready.");
    return this.schedules.addJob({
      name: scheduleName,
      options,
      payload: {},
      execute: async ({ scheduledAt, signal }) => {
        signal.throwIfAborted();
        await this.enqueue(`scheduled-${scheduledAt.getTime()}`);
      },
    });
  }

  async removeSchedule() {
    if (!this.schedules) throw new Error("Report schedules are not ready.");
    return this.schedules.removeJob(scheduleName);
  }

  async getSchedule() {
    if (!this.schedules) throw new Error("Report schedules are not ready.");
    return this.schedules.getJob(scheduleName);
  }

  stopAccepting(): void {
    this.jobs = undefined;
    this.ReportJob = undefined;
    this.schedules = undefined;
  }
}
