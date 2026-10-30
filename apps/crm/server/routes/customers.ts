import { Hono } from 'hono';
import { z } from 'zod';
import type { Application } from '@nocobase/app-server/application';
import {
  defineApiRoutes,
  executeIdempotentMutation,
  describeRoute,
  apiValidator,
  apiErrorResponses,
  apiErrorResponse,
  dataResponse,
  listResponse,
  type AppApiRouteContribution,
} from '@nocobase/app-server/router';
import { authenticationToken } from '@nocobase/app-plugin-authentication/server';
import {
  authorizationToken,
  type AuthorizationEnv,
} from '@nocobase/app-plugin-authorization/server';
import { databaseManagerToken, type RepositoryPolicy } from '@nocobase/db';
import type { Context } from 'hono';
import { userAdministrationServiceToken } from '@nocobase/app-plugin-authentication/server';
import { CustomerService } from '../customers/service.js';
import type { MiddlewareHandler } from 'hono';
import { customerServiceToken } from '../providers/customers.js';
import { customerError } from '../customers/service.js';
import type { CustomerAction } from '../customers/permissions.js';
import {
  createCustomer,
  editCustomer,
  listSalesOwners,
  listCustomers,
  progressCustomer,
  customerId,
  customerSchema,
  customerVersion,
} from '../customers/schemas.js';

type Env = {
  Variables: AuthorizationEnv['Variables'] & {
    customerPolicy: RepositoryPolicy;
  };
};
const meta = z.object({
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});
const errors = {
  ...apiErrorResponses,
  '404': apiErrorResponse(404),
  '409': apiErrorResponse(409),
  '400': apiErrorResponse(400),
};
export const customerRoutes: AppApiRouteContribution<Application> =
  defineApiRoutes((app) => {
    const router = new Hono();
    const customers = new Hono<Env>();
    const auth = app.container.resolve(authenticationToken);
    const authz = app.container.resolve(authorizationToken);
    const service = app.container.resolve(customerServiceToken);
    const connection = app.container.resolve(databaseManagerToken).connection();
    const users = app.container.resolve(userAdministrationServiceToken);
    const mutation = async (
      c: Context<Env>,
      action: CustomerAction,
      input: unknown,
      id?: string,
    ) => {
      const authorization = c.get('authz');
      const policy = c.get('customerPolicy');
      const presentationPolicies =
        await service.presentationPolicies(authorization);
      const result = await executeIdempotentMutation<{ id: string }>({
        connection,
        key: c.req.header('Idempotency-Key') ?? '',
        principal: `${app.appName}:${authorization.identity.principal.type}:${authorization.identity.principal.id}`,
        operation: `customers/${id ?? 'new'}/${action}`,
        input,
        authorize: async () => {
          await service.policy(authorization, action);
        },
        authorizeReplay: async (saved) => {
          const policy = await service.policy(authorization, action);
          // Deleted rows have no remaining result data to disclose. Other replays require current visibility.
          if (action !== 'delete') await service.find(policy, saved.id);
        },
        execute: async (transaction) => {
          const scoped = new CustomerService(
            transaction,
            users.withConnection(transaction),
          );
          const row =
            action === 'create'
              ? await scoped.create(policy, createCustomer.parse(input))
              : await (async () => {
                  const parsed =
                    action === 'edit'
                      ? editCustomer.parse(input)
                      : action === 'progress'
                        ? progressCustomer.parse(input)
                        : customerVersion.parse(input);
                  const { expectedUpdatedAt, ...values } = parsed;
                  return scoped.change(
                    policy,
                    id!,
                    expectedUpdatedAt,
                    values,
                    action === 'delete',
                  );
                })();
          return action === 'delete'
            ? { id: row.id }
            : (
                await scoped.present([row], authorization, presentationPolicies)
              )[0];
        },
      });
      c.header('Idempotency-Replayed', String(result.replayed));
      return { data: result.data };
    };
    customers.use('*', auth.required(), authz.middleware());
    const gate =
      (action: CustomerAction): MiddlewareHandler<Env> =>
      async (c, next) => {
        c.set('customerPolicy', await service.policy(c.get('authz'), action));
        await next();
      };
    customers.get(
      '/',
      gate('read'),
      describeRoute({
        tags: ['Customers'],
        operationId: 'listCustomers',
        summary: 'List accessible customers',
        responses: {
          '200': listResponse(customerSchema, meta),
          ...apiErrorResponses,
        },
      }),
      apiValidator('query', listCustomers),
      async (c) =>
        c.json(
          await service.list(
            c.get('customerPolicy'),
            c.req.valid('query'),
            c.get('authz'),
          ),
        ),
    );
    customers.get(
      '/salesOwners',
      async (c, next) => {
        const decisions = await Promise.all(
          ['create', 'edit'].map((action) =>
            c.get('authz').authorize({
              resource: { type: 'composite', id: 'customers' },
              action,
            }),
          ),
        );
        if (
          !decisions.some(
            (d) => d.effect !== 'deny' && d.conditions?.database?.customers,
          )
        )
          throw customerError('PERMISSION_DENIED', 'CUSTOMER_ACTION_DENIED');
        await next();
      },
      describeRoute({
        tags: ['Customers'],
        operationId: 'listCustomerSalesOwners',
        summary: 'List available customer salesOwners',
        responses: {
          '200': listResponse(
            z.object({ id: z.string(), name: z.string() }),
            meta,
          ),
          ...apiErrorResponses,
        },
      }),
      apiValidator('query', listSalesOwners),
      async (c) => c.json(await service.salesOwners(c.req.valid('query'))),
    );
    for (const action of ['read', 'edit', 'progress', 'delete'] as const) {
      customers.get(
        action === 'read' ? '/:id' : `/:id/${action}`,
        gate(action),
        describeRoute({
          tags: ['Customers'],
          operationId: `getCustomerFor${action}`,
          summary: `Read customer for ${action}`,
          responses: { '200': dataResponse(customerSchema), ...errors },
        }),
        apiValidator('param', customerId),
        async (c) => {
          const row = await service.find(
            c.get('customerPolicy'),
            c.req.valid('param').id,
          );
          return c.json({
            data: (await service.present([row], c.get('authz')))[0],
          });
        },
      );
    }
    customers.post(
      '/',
      gate('create'),
      describeRoute({
        tags: ['Customers'],
        operationId: 'createCustomer',
        summary: 'Create a customer',
        responses: { '201': dataResponse(customerSchema), ...errors },
      }),
      apiValidator('header', z.object({ 'idempotency-key': z.string() })),
      apiValidator('json', createCustomer),
      async (c) => {
        return c.json(await mutation(c, 'create', c.req.valid('json')), 201);
      },
    );
    customers.patch(
      '/:id',
      gate('edit'),
      describeRoute({
        tags: ['Customers'],
        operationId: 'editCustomer',
        summary: 'Edit customer details',
        responses: { '200': dataResponse(customerSchema), ...errors },
      }),
      apiValidator('param', customerId),
      apiValidator('header', z.object({ 'idempotency-key': z.string() })),
      apiValidator('json', editCustomer),
      async (c) => {
        return c.json(
          await mutation(
            c,
            'edit',
            c.req.valid('json'),
            c.req.valid('param').id,
          ),
        );
      },
    );
    customers.patch(
      '/:id/status',
      gate('progress'),
      describeRoute({
        tags: ['Customers'],
        operationId: 'progressCustomer',
        summary: 'Change customer progress',
        responses: { '200': dataResponse(customerSchema), ...errors },
      }),
      apiValidator('param', customerId),
      apiValidator('header', z.object({ 'idempotency-key': z.string() })),
      apiValidator('json', progressCustomer),
      async (c) => {
        return c.json(
          await mutation(
            c,
            'progress',
            c.req.valid('json'),
            c.req.valid('param').id,
          ),
        );
      },
    );
    customers.delete(
      '/:id',
      gate('delete'),
      describeRoute({
        tags: ['Customers'],
        operationId: 'deleteCustomer',
        summary: 'Delete a customer',
        responses: {
          '200': dataResponse(z.object({ id: z.string() })),
          ...errors,
        },
      }),
      apiValidator('param', customerId),
      apiValidator('header', z.object({ 'idempotency-key': z.string() })),
      apiValidator('query', customerVersion),
      async (c) => {
        return c.json(
          await mutation(
            c,
            'delete',
            c.req.valid('query'),
            c.req.valid('param').id,
          ),
        );
      },
    );
    router.route('/customers', customers);
    return router;
  });
