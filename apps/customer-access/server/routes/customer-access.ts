import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type { Application } from '@nocobase/app-server/application';
import { authenticationToken } from '@nocobase/app-plugin-authentication';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import {
  apiValidator,
  dataResponse,
  listResponse,
  apiErrorResponses,
  defineApiRoutes,
  describeRoute,
  executeIdempotentMutation,
} from '@nocobase/app-server/router';
import { customerAccessToken } from '../providers/customer-access.js';
import { authorizeAccess, type AccessEnv } from '../access/authorize.js';
import type { AccessAction } from '../access/permissions.js';
import { Customer, Order } from '../providers/customer-access-service.js';
const Query = z.strictObject({
  q: z.string().max(100).default(''),
  descending: z.enum(['true', 'false']).default('false'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
const Id = z.object({ id: z.uuid() });
const Values = z.strictObject({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(200),
  notes: z.string().max(1000).default(''),
});
const Key = z.object({
  'idempotency-key': z.string().regex(/^\d{13}\.[0-9a-f-]{36}$/i),
});
export default defineApiRoutes<Application>((app) => {
  const router = new Hono<AccessEnv>();
  const auth = app.container.resolve(authenticationToken);
  const authz = app.container.resolve(authorizationToken);
  const service = app.container.resolve(customerAccessToken);
  for (const path of ['/customers', '/customers/*', '/orders', '/orders/*'])
    router.use(
      path,
      auth.required(),
      authz.middleware(),
      bodyLimit({ maxSize: 8192 }),
    );
  const check =
    (action: AccessAction) =>
    async (
      c: Parameters<typeof authorizeAccess>[0],
      next: () => Promise<void>,
    ) => {
      await authorizeAccess(c, action);
      await next();
    };
  const doc = (
    operationId: string,
    schema: typeof Customer | typeof Order,
    list = false,
    status = 200,
  ) =>
    describeRoute({
      tags: ['Customer Access'],
      operationId,
      summary: operationId,
      security: [{ cookieAuth: [] }],
      responses: {
        [status]: list ? listResponse(schema) : dataResponse(schema),
        ...apiErrorResponses,
      },
    });
  router.get(
    '/customers',
    doc('listCustomers', Customer, true),
    check('viewCustomers'),
    apiValidator('query', Query),
    async (c) => {
      const policies = await authorizeAccess(c, 'viewCustomers');
      const { page, pageSize, q, descending } = c.req.valid('query');
      return c.json(
        await service.list(
          policies.accessCustomers,
          'accessCustomers',
          page,
          pageSize,
          q,
          descending === 'true',
        ),
      );
    },
  );
  router.get(
    '/customers/:id',
    doc('getCustomer', Customer),
    check('viewCustomers'),
    apiValidator('param', Id),
    async (c) =>
      c.json({
        data: await service.get(
          (await authorizeAccess(c, 'viewCustomers')).accessCustomers,
          c.req.valid('param').id,
        ),
      }),
  );
  router.get(
    '/orders',
    doc('listOrders', Order, true),
    check('viewOrders'),
    apiValidator('query', Query),
    async (c) => {
      const { page, pageSize, q, descending } = c.req.valid('query');
      return c.json(
        await service.list(
          (await authorizeAccess(c, 'viewOrders')).accessOrders,
          'accessOrders',
          page,
          pageSize,
          q,
          descending === 'true',
        ),
      );
    },
  );
  router.get(
    '/orders/customerOptions',
    doc('customerOptions', Customer, true),
    check('assignCustomer'),
    apiValidator('query', Query),
    async (c) => {
      const { page, pageSize, q, descending } = c.req.valid('query');
      return c.json(
        await service.list(
          (await authorizeAccess(c, 'assignCustomer')).accessCustomers,
          'accessCustomers',
          page,
          pageSize,
          q,
          descending === 'true',
        ),
      );
    },
  );
  router.get(
    '/orders/:id',
    doc('getOrder', Order),
    check('viewOrders'),
    apiValidator('param', Id),
    async (c) =>
      c.json({
        data: await service.getOrder(
          (await authorizeAccess(c, 'viewOrders')).accessOrders,
          c.req.valid('param').id,
        ),
      }),
  );
  router.get(
    '/customers/:id/editData',
    doc('customerEditData', Customer),
    check('editCustomer'),
    apiValidator('param', Id),
    async (c) =>
      c.json({
        data: await service.get(
          (await authorizeAccess(c, 'editCustomer')).accessCustomers,
          c.req.valid('param').id,
        ),
      }),
  );
  router.get(
    '/orders/:id/assignment',
    doc('orderAssignmentData', Order),
    check('assignCustomer'),
    apiValidator('param', Id),
    async (c) =>
      c.json({
        data: await service.getOrder(
          (await authorizeAccess(c, 'assignCustomer')).accessOrders,
          c.req.valid('param').id,
        ),
      }),
  );
  router.post(
    '/customers',
    doc('createCustomer', Customer, false, 201),
    check('createCustomer'),
    apiValidator('header', Key),
    apiValidator('json', Values),
    async (c) => {
      const policy = (await authorizeAccess(c, 'createCustomer'))
        .accessCustomers;
      const result = await executeIdempotentMutation<z.infer<typeof Customer>>({
        connection: service.connection,
        key: c.req.valid('header')['idempotency-key'],
        principal: `${app.appName}:${c.get('auth')!.user.id}`,
        operation: 'customerAccess.create',
        input: c.req.valid('json'),
        authorize: async () => {
          await authorizeAccess(c, 'createCustomer');
        },
        authorizeReplay: async (row) => {
          await service.get(policy, String(row.id));
        },
        execute: (tx) =>
          service.create(
            policy,
            c.get('auth')!.user.id,
            c.req.valid('json'),
            tx,
          ),
      });
      if (result.replayed) c.header('Idempotency-Replayed', 'true');
      return c.json({ data: result.data }, 201);
    },
  );
  router.patch(
    '/customers/:id',
    doc('editCustomer', Customer),
    check('editCustomer'),
    apiValidator('param', Id),
    apiValidator('header', Key),
    apiValidator('json', Values),
    async (c) => {
      const policy = (await authorizeAccess(c, 'editCustomer')).accessCustomers;
      const id = c.req.valid('param').id;
      const result = await executeIdempotentMutation<z.infer<typeof Customer>>({
        connection: service.connection,
        key: c.req.valid('header')['idempotency-key'],
        principal: `${app.appName}:${c.get('auth')!.user.id}`,
        operation: `customerAccess.edit:${id}`,
        input: c.req.valid('json'),
        authorize: async () => {
          await authorizeAccess(c, 'editCustomer');
        },
        authorizeReplay: async () => {
          await service.get(policy, id);
        },
        execute: (tx) => service.edit(policy, id, c.req.valid('json'), tx),
      });
      if (result.replayed) c.header('Idempotency-Replayed', 'true');
      return c.json({ data: result.data });
    },
  );
  router.post(
    '/orders/:id/assignCustomer',
    doc('assignCustomer', Order),
    check('assignCustomer'),
    apiValidator('param', Id),
    apiValidator('header', Key),
    apiValidator('json', z.strictObject({ customerId: z.uuid() })),
    async (c) => {
      const policies = await authorizeAccess(c, 'assignCustomer');
      const id = c.req.valid('param').id;
      const result = await executeIdempotentMutation<z.infer<typeof Order>>({
        connection: service.connection,
        key: c.req.valid('header')['idempotency-key'],
        principal: `${app.appName}:${c.get('auth')!.user.id}`,
        operation: `customerAccess.assign:${id}`,
        input: c.req.valid('json'),
        authorize: async () => {
          await authorizeAccess(c, 'assignCustomer');
        },
        authorizeReplay: async (row) => {
          await service.getOrder(policies.accessOrders, id);
          await service.get(policies.accessCustomers, String(row.customerId));
        },
        execute: (tx) =>
          service.assign(
            {
              customers: policies.accessCustomers,
              orders: policies.accessOrders,
            },
            id,
            c.req.valid('json').customerId,
            tx,
          ),
      });
      if (result.replayed) c.header('Idempotency-Replayed', 'true');
      return c.json({ data: result.data });
    },
  );
  return new Hono().route('/', router);
});
