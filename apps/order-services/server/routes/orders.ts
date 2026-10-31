import { Hono } from 'hono';
import { z } from 'zod';
import type { Application } from '@nocobase/app-server/application';
import {
  defineApiRoutes,
  describeRoute,
  apiValidator,
  dataResponse,
  apiErrorResponses,
  ApiError,
} from '@nocobase/app-server/router';
import { authenticationToken } from '@nocobase/app-plugin-authentication/server';
import {
  authorizationToken,
  type AuthorizationEnv,
} from '@nocobase/app-plugin-authorization/server';
import { orderServiceToken } from '../providers/orders.js';
import { orderJobsToken } from '../providers/order-jobs.js';
import { authorizeOrder, OrderAccessDenied } from '../orders/permissions.js';
import { OrderError } from '../orders/service.js';

const orderSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  productId: z.string(),
  quantity: z.number(),
  status: z.string(),
});
const idSchema = z.object({ id: z.string().min(1).max(80) });
export const orderRoutes = defineApiRoutes<Application>((app) => {
  const router = new Hono();
  const orders = new Hono<AuthorizationEnv>();
  const service = app.container.resolve(orderServiceToken);
  orders.use(
    '*',
    app.container.resolve(authenticationToken).required(),
    app.container.resolve(authorizationToken).middleware(),
  );
  orders.onError((error) => {
    if (error instanceof OrderAccessDenied)
      throw new ApiError({
        status: 'PERMISSION_DENIED',
        domain: 'orders',
        reason: 'ORDER_ACTION_DENIED',
        message: error.message,
      });
    if (error instanceof OrderError)
      throw new ApiError({
        status: error.code === 'ORDER_UNAVAILABLE' ? 'NOT_FOUND' : 'ABORTED',
        domain: 'orders',
        reason: error.code,
        message: error.message,
      });
    throw error;
  });
  orders.get(
    '/:id',
    describeRoute({
      operationId: 'getOrder',
      summary: 'Read an accessible order',
      responses: { '200': dataResponse(orderSchema), ...apiErrorResponses },
    }),
    apiValidator('param', idSchema),
    async (c) => {
      const policies = await authorizeOrder(c.get('authz'), 'read');
      return c.json({
        data: await service.get(policies.orders, c.req.valid('param').id),
      });
    },
  );
  orders.post(
    '/:id/confirm',
    describeRoute({
      operationId: 'confirmOrder',
      summary: 'Confirm an order and deduct stock',
      responses: { '200': dataResponse(orderSchema), ...apiErrorResponses },
    }),
    apiValidator('param', idSchema),
    async (c) => {
      const policies = await authorizeOrder(c.get('authz'), 'confirm');
      return c.json({
        data: await service.confirm(policies, c.req.valid('param').id),
      });
    },
  );
  orders.post(
    '/:id/confirmAsync',
    describeRoute({
      operationId: 'confirmOrderAsync',
      summary: 'Enqueue an order confirmation',
      responses: {
        '202': dataResponse(z.object({ jobId: z.string() })),
        ...apiErrorResponses,
      },
    }),
    apiValidator('param', idSchema),
    async (c) => {
      const policies = await authorizeOrder(c.get('authz'), 'confirm');
      const id = c.req.valid('param').id;
      await service.get(policies.orders, id);
      // Identity comes from authentication, never from a submitted actorId.
      const receipt = await app.container
        .resolve(orderJobsToken)
        .enqueue(id, c.get('authz').identity.principal.id);
      return c.json({ data: receipt }, 202);
    },
  );
  router.route('/orders', orders);
  return router;
});
