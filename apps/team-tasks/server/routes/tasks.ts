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
import { TaskService } from '../tasks/service.js';
import type { MiddlewareHandler } from 'hono';
import { taskServiceToken } from '../providers/tasks.js';
import { taskError } from '../tasks/service.js';
import type { TaskAction } from '../tasks/permissions.js';
import {
  createTask,
  editTask,
  listAssignees,
  listTasks,
  progressTask,
  taskId,
  taskSchema,
  taskVersion,
} from '../tasks/schemas.js';

type Env = {
  Variables: AuthorizationEnv['Variables'] & { taskPolicy: RepositoryPolicy };
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
export const taskRoutes: AppApiRouteContribution<Application> = defineApiRoutes(
  (app) => {
    const router = new Hono();
    const tasks = new Hono<Env>();
    const auth = app.container.resolve(authenticationToken);
    const authz = app.container.resolve(authorizationToken);
    const service = app.container.resolve(taskServiceToken);
    const connection = app.container.resolve(databaseManagerToken).connection();
    const users = app.container.resolve(userAdministrationServiceToken);
    const mutation = async (
      c: Context<Env>,
      action: TaskAction,
      input: unknown,
      id?: string,
    ) => {
      const authorization = c.get('authz');
      const policy = c.get('taskPolicy');
      const presentationPolicies =
        await service.presentationPolicies(authorization);
      const result = await executeIdempotentMutation<{ id: string }>({
        connection,
        key: c.req.header('Idempotency-Key') ?? '',
        principal: `${app.appName}:${authorization.identity.principal.type}:${authorization.identity.principal.id}`,
        operation: `tasks/${id ?? 'new'}/${action}`,
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
          const scoped = new TaskService(
            transaction,
            users.withConnection(transaction),
          );
          const row =
            action === 'create'
              ? await scoped.create(policy, createTask.parse(input))
              : await (async () => {
                  const parsed =
                    action === 'edit'
                      ? editTask.parse(input)
                      : action === 'progress'
                        ? progressTask.parse(input)
                        : taskVersion.parse(input);
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
    tasks.use('*', auth.required(), authz.middleware());
    const gate =
      (action: TaskAction): MiddlewareHandler<Env> =>
      async (c, next) => {
        c.set('taskPolicy', await service.policy(c.get('authz'), action));
        await next();
      };
    tasks.get(
      '/',
      gate('read'),
      describeRoute({
        tags: ['Tasks'],
        operationId: 'listTasks',
        summary: 'List accessible tasks',
        responses: {
          '200': listResponse(taskSchema, meta),
          ...apiErrorResponses,
        },
      }),
      apiValidator('query', listTasks),
      async (c) =>
        c.json(
          await service.list(
            c.get('taskPolicy'),
            c.req.valid('query'),
            c.get('authz'),
          ),
        ),
    );
    tasks.get(
      '/assignees',
      async (c, next) => {
        const decisions = await Promise.all(
          ['create', 'edit'].map((action) =>
            c.get('authz').authorize({
              resource: { type: 'composite', id: 'tasks' },
              action,
            }),
          ),
        );
        if (
          !decisions.some(
            (d) => d.effect !== 'deny' && d.conditions?.database?.tasks,
          )
        )
          throw taskError('PERMISSION_DENIED', 'TASK_ACTION_DENIED');
        await next();
      },
      describeRoute({
        tags: ['Tasks'],
        operationId: 'listTaskAssignees',
        summary: 'List available task assignees',
        responses: {
          '200': listResponse(
            z.object({ id: z.string(), name: z.string() }),
            meta,
          ),
          ...apiErrorResponses,
        },
      }),
      apiValidator('query', listAssignees),
      async (c) => c.json(await service.assignees(c.req.valid('query'))),
    );
    for (const action of ['read', 'edit', 'progress', 'delete'] as const) {
      tasks.get(
        action === 'read' ? '/:id' : `/:id/${action}`,
        gate(action),
        describeRoute({
          tags: ['Tasks'],
          operationId: `getTaskFor${action}`,
          summary: `Read task for ${action}`,
          responses: { '200': dataResponse(taskSchema), ...errors },
        }),
        apiValidator('param', taskId),
        async (c) => {
          const row = await service.find(
            c.get('taskPolicy'),
            c.req.valid('param').id,
          );
          return c.json({
            data: (await service.present([row], c.get('authz')))[0],
          });
        },
      );
    }
    tasks.post(
      '/',
      gate('create'),
      describeRoute({
        tags: ['Tasks'],
        operationId: 'createTask',
        summary: 'Create a task',
        responses: { '201': dataResponse(taskSchema), ...errors },
      }),
      apiValidator('header', z.object({ 'idempotency-key': z.string() })),
      apiValidator('json', createTask),
      async (c) => {
        return c.json(await mutation(c, 'create', c.req.valid('json')), 201);
      },
    );
    tasks.patch(
      '/:id',
      gate('edit'),
      describeRoute({
        tags: ['Tasks'],
        operationId: 'editTask',
        summary: 'Edit task details',
        responses: { '200': dataResponse(taskSchema), ...errors },
      }),
      apiValidator('param', taskId),
      apiValidator('header', z.object({ 'idempotency-key': z.string() })),
      apiValidator('json', editTask),
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
    tasks.patch(
      '/:id/status',
      gate('progress'),
      describeRoute({
        tags: ['Tasks'],
        operationId: 'progressTask',
        summary: 'Change task progress',
        responses: { '200': dataResponse(taskSchema), ...errors },
      }),
      apiValidator('param', taskId),
      apiValidator('header', z.object({ 'idempotency-key': z.string() })),
      apiValidator('json', progressTask),
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
    tasks.delete(
      '/:id',
      gate('delete'),
      describeRoute({
        tags: ['Tasks'],
        operationId: 'deleteTask',
        summary: 'Delete a task',
        responses: {
          '200': dataResponse(z.object({ id: z.string() })),
          ...errors,
        },
      }),
      apiValidator('param', taskId),
      apiValidator('header', z.object({ 'idempotency-key': z.string() })),
      apiValidator('query', taskVersion),
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
    router.route('/tasks', tasks);
    return router;
  },
);
