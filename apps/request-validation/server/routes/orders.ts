import { Hono, type MiddlewareHandler } from 'hono';
import type { Application } from '@nocobase/app-server/application';
import {
  ApiError,
  apiErrorHandler,
  apiErrorResponse,
  apiErrorResponses,
  apiValidator,
  dataResponse,
  defineApiRoutes,
  describeRoute,
  listResponse,
} from '@nocobase/app-server/router';
import { authenticationToken } from '@nocobase/app-plugin-authentication/server';
import {
  authorizationToken,
  type AuthorizationEnv,
} from '@nocobase/app-plugin-authorization/server';
import type { OrderPolicies } from '../orders/service.js';
import { orderServiceToken } from '../providers/orders.js';
import {
  CreateOrderInput,
  ListOrdersQuery,
  Order,
  OrderListMeta,
  OrderParams,
  UpdateOrderInput,
} from './schemas.js';
import { toOrderApiError } from './errors.js';

type OrderEnv = AuthorizationEnv & {
  Variables: { orderPolicies: OrderPolicies };
};

function requireOrderAction(
  action: 'read' | 'create' | 'update',
): MiddlewareHandler<OrderEnv> {
  return async (c, next) => {
    const decision = await c
      .get('authz')
      .authorize({ resource: { type: 'composite', id: 'orders' }, action });
    const policies = decision.conditions?.database;
    if (
      decision.effect === 'deny' ||
      !policies?.orders ||
      !policies.customers
    ) {
      throw new ApiError({
        status: 'PERMISSION_DENIED',
        reason: 'ORDER_ACTION_DENIED',
        domain: 'orders',
        message: 'This order action is not permitted.',
      });
    }
    c.set('orderPolicies', {
      orders: policies.orders,
      customers: policies.customers,
    });
    await next();
  };
}

export default defineApiRoutes<Application>((app) => {
  const router = new Hono<OrderEnv>();
  const service = app.container.resolve(orderServiceToken);
  router.use(
    '*',
    app.container.resolve(authenticationToken).required(),
    app.container.resolve(authorizationToken).middleware(),
  );
  router.onError((error, c) => apiErrorHandler(toOrderApiError(error), c));

  router.get(
    '/orders',
    requireOrderAction('read'),
    describeRoute({
      tags: ['Orders'],
      summary: 'List orders',
      operationId: 'ordersListOrders',
      responses: {
        '200': listResponse(Order, OrderListMeta),
        ...apiErrorResponses,
      },
    }),
    apiValidator('query', ListOrdersQuery),
    async (c) =>
      c.json(
        await service.list(c.get('orderPolicies').orders, c.req.valid('query')),
      ),
  );

  router.get(
    '/orders/:id',
    requireOrderAction('read'),
    describeRoute({
      tags: ['Orders'],
      summary: 'Read an order',
      operationId: 'ordersGetOrder',
      responses: {
        '200': dataResponse(Order),
        '404': apiErrorResponse(404),
        ...apiErrorResponses,
      },
    }),
    apiValidator('param', OrderParams),
    async (c) =>
      c.json({
        data: await service.get(
          c.get('orderPolicies').orders,
          c.req.valid('param').id,
        ),
      }),
  );

  router.post(
    '/orders',
    requireOrderAction('create'),
    describeRoute({
      tags: ['Orders'],
      summary: 'Create an order',
      operationId: 'ordersCreateOrder',
      responses: {
        '201': dataResponse(Order),
        '400': apiErrorResponse(
          400,
          'The customer is unavailable (CUSTOMER_UNAVAILABLE).',
        ),
        ...apiErrorResponses,
      },
    }),
    apiValidator('json', CreateOrderInput),
    async (c) =>
      c.json(
        {
          data: await service.create(
            c.get('orderPolicies'),
            c.req.valid('json'),
          ),
        },
        201,
      ),
  );

  router.patch(
    '/orders/:id',
    requireOrderAction('update'),
    describeRoute({
      tags: ['Orders'],
      summary: 'Edit a draft order',
      operationId: 'ordersUpdateOrder',
      responses: {
        '200': dataResponse(Order),
        '400': apiErrorResponse(
          400,
          'The customer is unavailable (CUSTOMER_UNAVAILABLE), or the order is confirmed (ORDER_LOCKED).',
        ),
        '404': apiErrorResponse(404),
        ...apiErrorResponses,
      },
    }),
    apiValidator('param', OrderParams),
    apiValidator('json', UpdateOrderInput),
    async (c) =>
      c.json({
        data: await service.update(
          c.get('orderPolicies'),
          c.req.valid('param').id,
          c.req.valid('json'),
        ),
      }),
  );
  const root = new Hono();
  root.route('/', router);
  return root;
});
