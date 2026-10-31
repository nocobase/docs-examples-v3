import { createStandaloneServer } from '../server/standalone.js';
import { actorContext } from '../server/orders/actor.js';
import { authorizeOrder } from '../server/orders/permissions.js';
import { orderServiceToken } from '../server/providers/orders.js';
export async function confirmFromCommand(
  app: Awaited<ReturnType<typeof createStandaloneServer>>['application'],
  actorId: string,
  orderId: string,
) {
  const policies = await authorizeOrder(
    await actorContext(app, actorId),
    'confirm',
  );
  return app.container.resolve(orderServiceToken).confirm(policies, orderId);
}
