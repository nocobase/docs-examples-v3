import { Job, type JobExecutionContext } from "@nocobase/jobs";

export interface ReportPayload {
  readonly reportId: string;
  readonly stepMs: number;
  readonly failure: "none" | "first" | "always";
}

export type GenerateReport = (
  payload: ReportPayload,
  context: JobExecutionContext,
) => Promise<void>;

export function createReportJob(generateReport: GenerateReport) {
  return class ReportJob extends Job<ReportPayload> {
    static readonly jobName: string = "reports.generate";

    async execute(context: JobExecutionContext): Promise<void> {
      context.signal.throwIfAborted();
      await generateReport(this.payload, context);
    }
  };
}
