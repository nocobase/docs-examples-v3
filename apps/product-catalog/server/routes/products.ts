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
import {
  ProductSchema as Product,
  type Product as ProductView,
} from '../providers/catalog-service.js';
import { catalogServiceToken } from '../providers/catalog.js';
import {
  catalogErrorHandler,
  productPolicy,
  type CatalogEnv,
} from './catalog-access.js';
const Query = z.strictObject({
  q: z.string().max(100).default(''),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
const Id = z.object({ id: z.uuid() });
const Values = z.strictObject({
  name: z.string().trim().min(1).max(100),
  priceCents: z.number().int().min(0).max(100000000),
});
const Operation = z.object({
  'idempotency-key': z.string().regex(/^\d{13}\.[0-9a-f-]{36}$/i),
});
export default defineApiRoutes<Application>((app) => {
  const router = new Hono<CatalogEnv>();
  const auth = app.container.resolve(authenticationToken);
  const authz = app.container.resolve(authorizationToken);
  const service = app.container.resolve(catalogServiceToken);
  router.onError(catalogErrorHandler);
  for (const path of ['/products', '/products/*'])
    router.use(
      path,
      auth.required({ scopedKeys: false }),
      authz.middleware(),
      bodyLimit({ maxSize: 8192 }),
    );
  router.get(
    '/products',
    describeRoute({
      tags: ['Products'],
      summary: 'List products',
      operationId: 'listProducts',
      responses: { 200: listResponse(Product), ...apiErrorResponses },
    }),
    apiValidator('query', Query),
    async (c) =>
      c.json(
        await service.list(
          await productPolicy(c, 'view'),
          c.req.valid('query'),
        ),
      ),
  );
  router.get(
    '/products/:id',
    describeRoute({
      tags: ['Products'],
      summary: 'Get a product',
      operationId: 'getProduct',
      responses: { 200: dataResponse(Product), ...apiErrorResponses },
    }),
    apiValidator('param', Id),
    async (c) =>
      c.json({
        data: await service.get(
          await productPolicy(c, 'view'),
          c.req.valid('param').id,
        ),
      }),
  );
  router.post(
    '/products',
    describeRoute({
      tags: ['Products'],
      summary: 'Create a draft product',
      operationId: 'createProduct',
      responses: { 201: dataResponse(Product), ...apiErrorResponses },
    }),
    apiValidator('header', Operation),
    apiValidator('json', Values),
    async (c) => {
      const policy = await productPolicy(c, 'create');
      const result = await executeIdempotentMutation<ProductView>({
        connection: service.connection,
        key: c.req.valid('header')['idempotency-key'],
        principal: `${app.appName}:${c.get('auth')!.user.id}`,
        operation: 'catalog.create',
        input: c.req.valid('json'),
        authorize: async () => {
          await productPolicy(c, 'create');
        },
        authorizeReplay: async (record) => {
          await service.get(policy, record.id);
        },
        execute: (transaction) =>
          service.create(policy, c.req.valid('json'), transaction),
      });
      if (result.replayed) c.header('Idempotency-Replayed', 'true');
      return c.json({ data: result.data }, 201);
    },
  );
  router.post(
    '/products/:id/publish',
    describeRoute({
      tags: ['Products'],
      summary: 'Publish a product',
      operationId: 'publishProduct',
      responses: { 200: dataResponse(Product), ...apiErrorResponses },
    }),
    apiValidator('param', Id),
    apiValidator('header', Operation),
    apiValidator('json', z.strictObject({})),
    async (c) => {
      const policy = await productPolicy(c, 'publish');
      const id = c.req.valid('param').id;
      const result = await executeIdempotentMutation<ProductView>({
        connection: service.connection,
        key: c.req.valid('header')['idempotency-key'],
        principal: `${app.appName}:${c.get('auth')!.user.id}`,
        operation: `catalog.publish:${id}`,
        input: { id },
        authorize: async () => {
          await productPolicy(c, 'publish');
        },
        authorizeReplay: async (record) => {
          await service.get(policy, record.id);
        },
        execute: (transaction) => service.publish(policy, id, transaction),
      });
      if (result.replayed) c.header('Idempotency-Replayed', 'true');
      return c.json({ data: result.data });
    },
  );
  return new Hono().route('/', router);
});
