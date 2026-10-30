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
import { databaseManagerToken } from '@nocobase/db';
import { projectServiceToken } from '../providers/projects.js';
import { ProjectService } from '../projects/service.js';
import {
  createProject,
  listProjects,
  projectSchema,
} from '../projects/schemas.js';
export const projectRoutes: AppApiRouteContribution<Application> =
  defineApiRoutes((app) => {
    const router = new Hono();
    const projects = new Hono<AuthorizationEnv>();
    const auth = app.container.resolve(authenticationToken);
    const authz = app.container.resolve(authorizationToken);
    const service = app.container.resolve(projectServiceToken);
    const connection = app.container.resolve(databaseManagerToken).connection();
    projects.use('*', auth.required(), authz.middleware());
    projects.get(
      '/',
      describeRoute({
        tags: ['Projects'],
        operationId: 'listProjects',
        summary: 'List accessible projects',
        responses: {
          '200': listResponse(
            projectSchema,
            z.object({
              total: z.number(),
              page: z.number(),
              pageSize: z.number(),
            }),
          ),
          ...apiErrorResponses,
        },
      }),
      apiValidator('query', listProjects),
      async (c) => {
        const policy = await service.policy(c.get('authz'), 'read');
        return c.json(await service.list(policy, c.req.valid('query')));
      },
    );
    projects.post(
      '/',
      describeRoute({
        tags: ['Projects'],
        operationId: 'createProject',
        summary: 'Create a project',
        responses: {
          '201': dataResponse(projectSchema),
          ...apiErrorResponses,
          '400': apiErrorResponse(400),
          '409': apiErrorResponse(409),
        },
      }),
      apiValidator('json', createProject),
      async (c) => {
        const authorization = c.get('authz');
        const policy = await service.policy(authorization, 'create');
        const input = c.req.valid('json');
        const result = await executeIdempotentMutation<{
          id: string;
          name: string;
          createdAt: string;
        }>({
          connection,
          key: c.req.header('Idempotency-Key') ?? '',
          principal: `${app.appName}:${authorization.identity.principal.type}:${authorization.identity.principal.id}`,
          operation: 'projects/create',
          input,
          authorize: async () => {
            await service.policy(authorization, 'create');
          },
          authorizeReplay: async (saved) => {
            await service.assertVisible(
              await service.policy(authorization, 'create'),
              saved.id,
            );
          },
          execute: (transaction) =>
            new ProjectService(transaction).create(policy, input.name),
        });
        c.header('Idempotency-Replayed', String(result.replayed));
        return c.json({ data: result.data }, 201);
      },
    );
    router.route('/projects', projects);
    return router;
  });
