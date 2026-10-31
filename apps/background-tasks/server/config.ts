import type { AppJobsConfig } from "@nocobase/app-server/jobs";
import type { ScheduleJobOption } from "@nocobase/jobs";

export const jobs: AppJobsConfig = {
  default: "memory",
  memory: { adapter: "memory", concurrency: 1, attempts: 3 },
};

export interface ReportsConfig {
  readonly consume: boolean;
  readonly schedule?: ScheduleJobOption;
}
