import type { Application } from '@nocobase/app-server/application';
import { jobExecutorServiceToken } from '@nocobase/app-server/jobs';
import type { JobExecutor } from '@nocobase/jobs';
import {
  ServiceProvider,
  createServiceToken,
} from '@nocobase/service-provider';
import { createConfirmOrderJob } from '../orders/job.js';
import { orderServiceToken } from './orders.js';
export interface OrderJobs {
  enqueue(orderId: string, actorId: string): Promise<{ jobId: string }>;
}
export const orderJobsToken = createServiceToken<OrderJobs>(
  'order-services/jobs',
);
export default class OrderJobsProvider extends ServiceProvider<Application> {
  readonly name = 'order-services/jobs';
  private executor?: JobExecutor;
  override async start(): Promise<void> {
    const ConfirmOrderJob = createConfirmOrderJob(
      this.app,
      this.app.container.resolve(orderServiceToken),
    );
    this.executor = this.app.container
      .resolve(jobExecutorServiceToken)
      .getJobExecutor('order-services');
    this.executor.registerJob(ConfirmOrderJob);
    await this.executor.setup();
    const executor = this.executor;
    this.app.container.instance(orderJobsToken, {
      enqueue: async (orderId, actorId) => {
        const receipt = await executor.addJob(
          new ConfirmOrderJob({ orderId, actorId }),
        );
        return { jobId: receipt.jobId };
      },
    });
  }
  override async shutdown(): Promise<void> {
    await this.executor?.shutdown();
  }
}
