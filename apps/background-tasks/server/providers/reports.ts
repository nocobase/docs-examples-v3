import type { Application } from "@nocobase/app-server/application";
import { jobExecutorServiceToken } from "@nocobase/app-server/jobs";
import { ServiceProvider } from "@nocobase/service-provider";
import type {
  JobExecutor,
  ScheduleExecutor,
  Unsubscribe,
} from "@nocobase/jobs";
import type { ReportsConfig } from "../config.js";
import { createReportJob } from "../jobs/report-job.js";
import { generateReport } from "../reports/generate.js";
import { ReportJobs, reportJobsToken } from "../reports/service.js";

export default class ReportsProvider extends ServiceProvider<Application> {
  readonly name = "app/reports";
  private jobs?: JobExecutor;
  private schedules?: ScheduleExecutor;
  private unsubscribe?: Unsubscribe;

  override register(): void {
    this.app.container.singleton(reportJobsToken, () => new ReportJobs());
  }

  override async start(): Promise<void> {
    const executors = this.app.container.resolve(jobExecutorServiceToken);
    const reports = this.app.container.resolve(reportJobsToken);
    const config = this.app.config.get<ReportsConfig>("reports")!;
    const ReportJob = createReportJob((payload, context) =>
      generateReport(this.app.paths.storage("reports"), payload, context),
    );
    this.jobs = executors.getJobExecutor("app.reports");
    this.schedules = executors.getScheduleExecutor("app.reports.schedule");
    this.unsubscribe = this.jobs.subscribe((event) => reports.record(event));
    try {
      this.jobs.registerJob(ReportJob);
      await this.jobs.setup({ consume: config.consume });
      reports.attach(this.jobs, ReportJob, this.schedules);
      if (config.schedule) await reports.schedule(config.schedule);
      await this.schedules.setup({ consume: config.consume });
    } catch (error) {
      await this.shutdown();
      throw error;
    }
  }

  override async shutdown(): Promise<void> {
    try {
      // Let a running schedule finish submitting before closing its consumer.
      await this.schedules?.shutdown();
    } finally {
      this.app.container.resolve(reportJobsToken).stopAccepting();
      try {
        await this.jobs?.shutdown();
      } finally {
        this.unsubscribe?.();
      }
    }
  }
}
