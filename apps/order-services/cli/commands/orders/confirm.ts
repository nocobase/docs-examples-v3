import { AppCommand, CommandError } from '@nocobase/app-cli';
import { Args } from '@oclif/core';
import { confirmFromCommand } from '../../confirm.js';
import { OrderError } from '../../../server/orders/service.js';
import { OrderAccessDenied } from '../../../server/orders/permissions.js';
export default class ConfirmOrder extends AppCommand {
  static override summary =
    'Confirm an order as an explicitly selected local actor.';
  static override args = {
    actorId: Args.string({ required: true }),
    orderId: Args.string({ required: true }),
  };
  async run() {
    const { args } = await this.parse(ConfirmOrder);
    const result = await this.withApp(async ({ app }) => {
      // Authorization registration needs boot(); this command uses the full lifecycle.
      await app.start();
      try {
        return await confirmFromCommand(app, args.actorId, args.orderId);
      } catch (error) {
        if (error instanceof OrderError || error instanceof OrderAccessDenied) {
          throw new CommandError(error.message, {
            code:
              error instanceof OrderError ? error.code : 'ORDER_ACTION_DENIED',
          });
        }
        throw error;
      }
    });
    this.log(`Order ${result.id}: ${result.status}`);
    return result;
  }
}
