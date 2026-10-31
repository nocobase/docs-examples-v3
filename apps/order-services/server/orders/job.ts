import { Job } from '@nocobase/jobs';
import type { Application } from '@nocobase/app-server/application';
import type { OrderService } from './service.js';
import { authorizeOrder } from './permissions.js';
import { actorContext } from './actor.js';
export function createConfirmOrderJob(app: Application, service: OrderService) {
  return class ConfirmOrderJob extends Job<{
    orderId: string;
    actorId: string;
  }> {
    static readonly jobName = 'orders.confirm';
    async execute(): Promise<void> {
      const context = await actorContext(app, this.payload.actorId);
      const policies = await authorizeOrder(context, 'confirm');
      await service.confirm(policies, this.payload.orderId);
    }
  };
}
