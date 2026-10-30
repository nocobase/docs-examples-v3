import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import type { Application } from '@nocobase/app-server/application';
import {
  apiErrorHandler,
  apiErrorResponse,
  apiErrorResponses,
  apiValidator,
  ApiError,
  dataResponse,
  defineApiRoutes,
  describeRoute,
  listResponse,
  type AppApiRouteContribution,
} from '@nocobase/app-server/router';
import {
  authenticationToken,
  userAdministrationServiceToken,
  type AuthEnv,
} from '@nocobase/app-plugin-authentication/server';
import {
  authorizationToken,
  type AuthorizationEnv,
} from '@nocobase/app-plugin-authorization/server';
import { databaseManagerToken } from '@nocobase/db';
import { ParameterConfigurationError } from '@nocobase/lifecycle';
import {
  lifecycleParametersToken,
  lifecycleRuntimeToken,
  PARAMETER_SCOPE,
} from '../providers/requests.js';
import { WorkflowService } from '../workflows/service.js';

type Env = AuthEnv & AuthorizationEnv;

const workflowParams = z.object({ workflowId: z.string().min(1).max(100) });
const executionParams = workflowParams.extend({ recordId: z.uuid() });
const page = z.object({
  workflowId: z.string().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
const parametersInput = z.strictObject({
  values: z.record(z.string(), z.unknown()),
  expectedRevision: z.number().int().min(0),
  requestId: z.string().min(1).max(100),
});
const anything = z.record(z.string(), z.unknown());
const failures = {
  ...apiErrorResponses,
  '400': apiErrorResponse(400),
  '404': apiErrorResponse(404),
};

/** A rejected parameter save as the standard error body: a stale revision is 409, invalid values 400. */
function toApiError(error: unknown): unknown {
  if (!(error instanceof ParameterConfigurationError)) return error;
  const conflict =
    error.code === 'CONFIGURATION_CONFLICT' ||
    error.code === 'CONFIGURATION_REQUEST_REUSED';
  return new ApiError({
    status: conflict ? 'ABORTED' : 'INVALID_ARGUMENT',
    reason: error.code,
    domain: 'workflows',
    message: error.message,
  });
}

export const workflowRoutes: AppApiRouteContribution<Application> =
  defineApiRoutes((app) => {
    const router = new Hono<Env>();
    router.onError((error, c) => apiErrorHandler(toApiError(error), c));
    const allowed = (action: 'read' | 'update') =>
      createMiddleware<AuthorizationEnv>(async (c, next) => {
        await c.get('authz').require({
          resource: { type: 'settings', id: 'workflow-management' },
          action,
        });
        await next();
      });
    router.use(
      '*',
      app.container.resolve(authenticationToken).required(),
      app.container.resolve(authorizationToken).middleware(),
      allowed('read'),
    );
    const service = new WorkflowService(
      app.container.resolve(databaseManagerToken),
      app.container.resolve(lifecycleRuntimeToken),
      app.container.resolve(lifecycleParametersToken),
      PARAMETER_SCOPE,
      app.container.resolve(userAdministrationServiceToken),
    );
    const tags = ['Workflow management'];

    router.get(
      '/definitions',
      describeRoute({
        tags,
        operationId: 'listWorkflowDefinitions',
        summary: 'List the workflows this application runs',
        responses: { '200': dataResponse(z.array(anything)), ...failures },
      }),
      async (c) => c.json({ data: await service.definitions() }),
    );
    router.get(
      '/definitions/:workflowId',
      describeRoute({
        tags,
        operationId: 'getWorkflowDefinition',
        summary: 'Describe a workflow',
        responses: { '200': dataResponse(anything), ...failures },
      }),
      apiValidator('param', workflowParams),
      async (c) =>
        c.json({
          data: await service.definition(c.req.valid('param').workflowId),
        }),
    );
    router.get(
      '/definitions/:workflowId/parameters',
      describeRoute({
        tags,
        operationId: 'getWorkflowParameters',
        summary: 'Read the parameters an administrator may adjust',
        responses: { '200': dataResponse(anything), ...failures },
      }),
      apiValidator('param', workflowParams),
      async (c) =>
        c.json({
          data: await service.readParameters(c.req.valid('param').workflowId),
        }),
    );
    router.put(
      '/definitions/:workflowId/parameters',
      allowed('update'),
      describeRoute({
        tags,
        operationId: 'saveWorkflowParameters',
        summary: 'Save the complete parameter group from the revision read',
        responses: {
          '200': dataResponse(anything),
          '409': apiErrorResponse(409),
          ...failures,
        },
      }),
      apiValidator('param', workflowParams),
      apiValidator('json', parametersInput),
      async (c) => {
        const { values, expectedRevision, requestId } = c.req.valid('json');
        return c.json({
          data: await service.saveParameters(
            c.req.valid('param').workflowId,
            values as never,
            expectedRevision,
            requestId,
            String(c.get('auth')!.user.id),
          ),
        });
      },
    );
    router.get(
      '/executions',
      describeRoute({
        tags,
        operationId: 'listWorkflowExecutions',
        summary: 'List workflow executions, one per business record',
        responses: {
          '200': listResponse(
            anything,
            z.object({
              page: z.number(),
              pageSize: z.number(),
              total: z.number(),
            }),
          ),
          ...failures,
        },
      }),
      apiValidator('query', page),
      async (c) => {
        const { page: current, pageSize, workflowId } = c.req.valid('query');
        return c.json(await service.executions(current, pageSize, workflowId));
      },
    );
    router.get(
      '/executions/:workflowId/:recordId',
      describeRoute({
        tags,
        operationId: 'getWorkflowExecution',
        summary:
          'Inspect one execution: its history, effects and the definition',
        responses: { '200': dataResponse(anything), ...failures },
      }),
      apiValidator('param', executionParams),
      async (c) => {
        const { workflowId, recordId } = c.req.valid('param');
        return c.json({
          data: await service.execution(
            workflowId,
            recordId,
            String(c.get('auth')!.user.id),
          ),
        });
      },
    );

    return new Hono().route('/workflows', router);
  });
