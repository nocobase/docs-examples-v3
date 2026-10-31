import { customerResource } from '../customer-resource.js';
import type { AuthorizationContext } from '@nocobase/app-plugin-authorization/server';
import type { Application } from '@nocobase/app-server/application';
import {
  authenticationToken,
  type AuthEnv,
} from '@nocobase/app-plugin-authentication';
import {
  authorizationToken,
  type AuthorizationEnv,
} from '@nocobase/app-plugin-authorization/server';
import { databaseManagerToken } from '@nocobase/db';
import {
  ApiError,
  apiErrorHandler,
  apiErrorResponses,
  apiValidator,
  dataResponse,
  listResponse,
  defineApiRoutes,
  defineRepositoryApiRoutes,
  describeRoute,
} from '@nocobase/app-server/router';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';

const Customer = z.object({
  id: z.string(),
  name: z.string(),
  contact: z.string(),
  email: z.string(),
  status: z.enum(['active', 'inactive']),
});
const Values = Customer.omit({ id: true }).extend({
  name: z.string().trim().min(1).max(100),
  contact: z.string().trim().min(1).max(100),
  email: z.email().max(200),
});
const Query = z.object({
  q: z.string().max(100).default(''),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce
    .number()
    .refine((v) => [5, 10, 20].includes(v))
    .default(10),
  sort: z.enum(['name', 'contact', 'email', 'status']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
  demo: z.enum(['normal', 'slow', 'fail', 'race']).default('normal'),
});
const repositoryRoutes = defineRepositoryApiRoutes({
  repositories: [
    {
      name: 'customers',
      policy: {
        read: {
          scope: true,
          fields: ['id', 'name', 'contact', 'email', 'status'],
        },
        create: {
          scope: true,
          fields: ['id', 'name', 'contact', 'email', 'status'],
        },
        update: { scope: true, fields: ['name', 'contact', 'email', 'status'] },
        delete: true,
      },
      actions: {
        findOne: {},
        findMany: { maxLimit: 100 },
        count: {},
        createOne: {},
        updateOne: {},
        deleteOne: {},
      },
    },
  ],
});
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const demoError = (
  reason: string,
  status: 'UNAVAILABLE' | 'INVALID_ARGUMENT' = 'UNAVAILABLE',
) =>
  new ApiError({
    status,
    reason,
    domain: 'customerDemo',
    message: 'The requested demonstration interrupted this response.',
  });

export const customersRoutes = defineApiRoutes(async (app: Application) => {
  const router = new Hono<AuthEnv & AuthorizationEnv>();
  router.onError(apiErrorHandler);
  const auth = app.container.resolve(authenticationToken);
  const authz = app.container.resolve(authorizationToken);
  // Authentication is shared; business actions are authorized independently of page access.
  for (const path of [
    '/customerList',
    '/customerRecord/*',
    '/customerDemo/*',
    '/customers/*',
  ]) {
    router.use(
      path,
      auth.required({ scopedKeys: false }),
      authz.middleware(),
      bodyLimit({ maxSize: 8192 }),
    );
  }
  const connection = app.container.resolve(databaseManagerToken).connection();
  const repository = connection.repository('customers');
  router.use(
    '/customers/*',
    authz.database.authorizeRepository({
      repository: 'customers',
      resource: customerResource.reference(),
      actions: {
        findOne: 'view',
        findMany: 'view',
        count: 'view',
        createOne: 'create',
        updateOne: 'edit',
        deleteOne: 'delete',
      },
    }),
  );
  async function readable(authorization: AuthorizationContext) {
    const decision = await authorization.authorize({
      resource: { type: 'composite', id: 'customers' },
      action: 'view',
    });
    const policy = decision.conditions?.database?.customers;
    if (decision.effect === 'deny' || !policy)
      throw new ApiError({
        status: 'PERMISSION_DENIED',
        reason: 'AUTHORIZATION_DENIED',
        domain: 'customers',
        message: 'Customer access is denied.',
      });
    return repository.withPolicy(policy);
  }
  const faults = new Map<string, { mode: string; expires: number }>();
  router.get(
    '/customerList',
    describeRoute({
      tags: ['Customers'],
      summary: 'Search and page customers',
      responses: { 200: listResponse(Customer), ...apiErrorResponses },
    }),
    apiValidator('query', Query),
    async (c) => {
      const repository = await readable(c.get('authz'));
      const query = c.req.valid('query');
      const demo =
        process.env.CUSTOMER_DEMO_FAULTS === '1' ? query.demo : 'normal';
      if (demo === 'fail') throw demoError('DEMO_READ_FAILED');
      const filter: NonNullable<
        Parameters<typeof repository.count>[0]
      >['filter'] = (f) =>
        f.and([
          f.string('name').includes(query.q, { mode: 'insensitive' }),
          f.or(
            (query.status === 'all'
              ? ['active', 'inactive']
              : [query.status]
            ).map((value) => f.string('status').eq(value)),
          ),
        ]);
      const [data, total] = await Promise.all([
        repository.findMany({
          filter,
          limit: query.pageSize,
          offset: (query.page - 1) * query.pageSize,
          sort: (s) => [
            query.order === 'desc'
              ? s.field(query.sort).desc()
              : s.field(query.sort).asc(),
            s.field('id').asc(),
          ],
        }),
        repository.count({ filter }),
      ]);
      if (demo === 'slow') await wait(1600);
      if (demo === 'race') await wait(query.q.length <= 1 ? 1800 : 150);
      return c.json({ data, meta: { total } });
    },
  );
  router.get(
    '/customerRecord/:id',
    describeRoute({
      tags: ['Customers'],
      summary: 'Read a customer',
      responses: { 200: dataResponse(Customer), ...apiErrorResponses },
    }),
    apiValidator('param', z.object({ id: z.string().max(64) })),
    async (c) => {
      const repository = await readable(c.get('authz'));
      const data = await repository.findOne({
        filter: { id: c.req.valid('param').id },
      });
      if (!data)
        throw new ApiError({
          status: 'NOT_FOUND',
          reason: 'CUSTOMER_NOT_FOUND',
          domain: 'customers',
          message: 'Customer does not exist.',
        });
      return c.json({ data });
    },
  );
  router.post(
    '/customerDemo/nextWrite',
    describeRoute({
      tags: ['Customer demonstration'],
      summary: 'Arm one fault for a specific operation key',
      responses: {
        200: dataResponse(z.object({ armed: z.boolean() })),
        ...apiErrorResponses,
      },
    }),
    apiValidator(
      'json',
      z.object({
        key: z.string().regex(/^\d{13}\.[0-9a-f-]{36}$/),
        mode: z.enum(['reject', 'lose', 'slow']),
      }),
    ),
    async (c) => {
      await readable(c.get('authz'));
      if (process.env.CUSTOMER_DEMO_FAULTS !== '1')
        throw new ApiError({
          status: 'FAILED_PRECONDITION',
          reason: 'DEMO_DISABLED',
          domain: 'customerDemo',
          message: 'Fault demonstrations are not enabled.',
        });
      for (const [key, item] of faults)
        if (item.expires < Date.now()) faults.delete(key);
      const { key, mode } = c.req.valid('json');
      faults.set(`${c.get('auth')!.user.id}:${key}`, {
        mode,
        expires: Date.now() + 300000,
      });
      return c.json({ data: { armed: true } });
    },
  );
  for (const action of ['createOne', 'updateOne', 'deleteOne']) {
    router.use(`/customers/${action}`, async (c, next) => {
      const faultKey = `${c.get('auth')!.user.id}:${c.req.header('Idempotency-Key')}`;
      const fault = faults.get(faultKey);
      faults.delete(faultKey);
      const mode = fault && fault.expires > Date.now() ? fault.mode : 'normal';
      if (mode === 'reject')
        throw demoError('DEMO_SAVE_REJECTED', 'INVALID_ARGUMENT');
      if (action !== 'deleteOne') {
        const body = await c.req.raw
          .clone()
          .json()
          .catch(() => undefined);
        const input = z.object({ values: z.unknown() }).safeParse(body);
        const parsed = (
          action === 'createOne'
            ? Values.extend({ id: z.string().uuid() })
            : Values
        )
          .strict()
          .safeParse(input.success ? input.data.values : undefined);
        if (!parsed.success)
          throw new ApiError({
            status: 'INVALID_ARGUMENT',
            reason: 'INVALID_CUSTOMER',
            domain: 'customers',
            message: 'Invalid customer fields.',
            fieldViolations: parsed.error.issues.map((i) => ({
              field: i.path.join('.'),
              description: 'Check this value.',
            })),
          });
      }
      if (mode === 'slow') await wait(1600);
      await next();
      // The real mutation and receipt already committed. Retry keeps the same key.
      if (mode === 'lose' && c.res.ok) throw demoError('DEMO_RESPONSE_LOST');
    });
  }
  router.route('/', await repositoryRoutes.createRouter(app));
  return new Hono().route('/', router);
});
