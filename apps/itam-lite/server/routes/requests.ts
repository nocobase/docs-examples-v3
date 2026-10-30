import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import type { Application } from '@nocobase/app-server/application';
import {
  apiErrorHandler,
  apiErrorResponse,
  apiErrorResponses,
  apiValidator,
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
import { databaseManagerToken, type RepositoryPolicy } from '@nocobase/db';
import { lifecycleDescriptionViewAsync } from '@nocobase/lifecycle';
import {
  lifecycleParametersToken,
  lifecycleRuntimeToken,
  PARAMETER_SCOPE,
  requestServiceToken,
} from '../providers/requests.js';
import { WorkflowService } from '../workflows/service.js';
import { REQUEST_LIFECYCLE } from '../requests/lifecycle.js';
import type { RequestAction } from '../requests/permissions.js';
import {
  createRequest,
  fireRequest,
  listRequests,
  requestId,
  requestSchema,
} from '../requests/schemas.js';
import { requestError, toApiError } from '../requests/service.js';

type Env = AuthEnv & {
  Variables: AuthorizationEnv['Variables'] & {
    requestPolicy: RepositoryPolicy;
  };
};

const meta = z.object({
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});
const errors = {
  ...apiErrorResponses,
  '400': apiErrorResponse(400),
  '404': apiErrorResponse(404),
  '409': apiErrorResponse(409),
};
const detailSchema = z.object({
  request: requestSchema,
  view: z.record(z.string(), z.unknown()),
  can: z.object({
    approve: z.boolean(),
    issue: z.boolean(),
    withdraw: z.boolean(),
  }),
});

export const requestRoutes: AppApiRouteContribution<Application> =
  defineApiRoutes((app) => {
    const router = new Hono();
    const requests = new Hono<Env>();
    const auth = app.container.resolve(authenticationToken);
    const authz = app.container.resolve(authorizationToken);
    const service = app.container.resolve(requestServiceToken);
    const runtime = app.container.resolve(lifecycleRuntimeToken);
    const workflows = new WorkflowService(
      app.container.resolve(databaseManagerToken),
      runtime,
      app.container.resolve(lifecycleParametersToken),
      PARAMETER_SCOPE,
      app.container.resolve(userAdministrationServiceToken),
    );
    requests.onError((error, c) => apiErrorHandler(toApiError(error), c));
    requests.use('*', auth.required(), authz.middleware());
    const gate =
      (action: RequestAction): MiddlewareHandler<Env> =>
      async (c, next) => {
        c.set('requestPolicy', await service.policy(c.get('authz'), action));
        await next();
      };
    const userId = (c: { get(key: 'auth'): Env['Variables']['auth'] }) =>
      String(c.get('auth')!.user.id);

    requests.get(
      '/',
      gate('read'),
      describeRoute({
        tags: ['Device requests'],
        operationId: 'listDeviceRequests',
        summary: 'List the device requests the person may see',
        responses: {
          '200': listResponse(requestSchema, meta),
          ...apiErrorResponses,
        },
      }),
      apiValidator('query', listRequests),
      async (c) =>
        c.json(
          await service.list(
            c.get('requestPolicy'),
            c.req.valid('query'),
            userId(c),
          ),
        ),
    );

    requests.get(
      '/lifecycle',
      gate('read'),
      describeRoute({
        tags: ['Device requests'],
        operationId: 'describeDeviceRequestLifecycle',
        summary: 'Describe the device request workflow',
        responses: {
          '200': dataResponse(z.record(z.string(), z.unknown())),
          ...apiErrorResponses,
        },
      }),
      async (c) =>
        c.json({
          data: await lifecycleDescriptionViewAsync(
            runtime,
            REQUEST_LIFECYCLE,
            { record: null, transactionHandle: undefined },
          ),
        }),
    );

    requests.post(
      '/',
      gate('create'),
      describeRoute({
        tags: ['Device requests'],
        operationId: 'createDeviceRequest',
        summary: 'Submit a device request for yourself',
        responses: { '201': dataResponse(requestSchema), ...errors },
      }),
      apiValidator(
        'header',
        z.object({ 'idempotency-key': z.string().min(1).max(100) }),
      ),
      apiValidator('json', createRequest),
      async (c) => {
        const id = await service.submit(
          c.req.valid('json'),
          userId(c),
          c.req.valid('header')['idempotency-key'],
        );
        const row = await service.find(c.get('requestPolicy'), id);
        return c.json({ data: (await service.present([row]))[0] }, 201);
      },
    );

    requests.get(
      '/:id',
      gate('read'),
      describeRoute({
        tags: ['Device requests'],
        operationId: 'getDeviceRequest',
        summary: 'Read a device request with its workflow progress',
        responses: { '200': dataResponse(detailSchema), ...errors },
      }),
      apiValidator('param', requestId),
      async (c) => {
        const row = await service.find(
          c.get('requestPolicy'),
          c.req.valid('param').id,
        );
        const view = await runtime.view(REQUEST_LIFECYCLE, row.id, {
          id: userId(c),
        });
        return c.json({
          data: {
            request: (await service.present([row]))[0],
            view,
            actors: await workflows.actors(view.history.transitions),
            // Which of the workflow's next steps this person's role allows. The page shows only these buttons; the fire
            // route checks the same actions again, so a hidden button is never the only protection.
            can: {
              approve: !!(await service.optionalPolicy(
                c.get('authz'),
                'approve',
              )),
              issue: !!(await service.optionalPolicy(c.get('authz'), 'issue')),
              withdraw: !!(await service.optionalPolicy(
                c.get('authz'),
                'withdraw',
              )),
            },
          },
        });
      },
    );

    requests.get(
      '/:id/issuable',
      gate('issue'),
      describeRoute({
        tags: ['Device requests'],
        operationId: 'listIssuableDevices',
        summary: 'List in-stock devices that can be issued for a request',
        responses: {
          '200': dataResponse(
            z.array(
              z.object({
                id: z.string(),
                assetTag: z.string(),
                name: z.string(),
              }),
            ),
          ),
          ...errors,
        },
      }),
      apiValidator('param', requestId),
      async (c) => {
        const row = await service.find(
          c.get('requestPolicy'),
          c.req.valid('param').id,
        );
        const devicePolicy = await service.optionalPolicy(
          c.get('authz'),
          'issue',
          'devices',
        );
        if (!devicePolicy)
          throw requestError('PERMISSION_DENIED', 'REQUEST_ACTION_DENIED');
        return c.json({ data: await service.issuable(row, devicePolicy) });
      },
    );

    // Each transition is authorized as its own business action before the lifecycle checks its guards.
    requests.post(
      '/:id/fire',
      async (c, next) => {
        const body = (await c.req.raw
          .clone()
          .json()
          .catch(() => ({}))) as { transition?: unknown };
        const action = body.transition;
        if (
          action !== 'approve' &&
          action !== 'reject' &&
          action !== 'issue' &&
          action !== 'withdraw'
        )
          throw requestError(
            'INVALID_ARGUMENT',
            'REQUEST_TRANSITION_UNKNOWN',
            'transition',
          );
        return gate(action === 'reject' ? 'approve' : action)(c, next);
      },
      describeRoute({
        tags: ['Device requests'],
        operationId: 'fireDeviceRequest',
        summary: 'Approve, reject, issue or withdraw a device request',
        responses: { '200': dataResponse(requestSchema), ...errors },
      }),
      apiValidator('param', requestId),
      apiValidator('json', fireRequest),
      async (c) => {
        const body = c.req.valid('json');
        const row = await service.find(
          c.get('requestPolicy'),
          c.req.valid('param').id,
        );
        if (body.transition === 'issue') {
          const devicePolicy = await service.optionalPolicy(
            c.get('authz'),
            'issue',
            'devices',
          );
          if (!devicePolicy)
            throw requestError('PERMISSION_DENIED', 'REQUEST_ACTION_DENIED');
          await service.issue(
            row,
            body.input.deviceId,
            devicePolicy,
            userId(c),
            body.requestId,
            body.expectVersion,
          );
        } else
          await service.fire(
            row,
            body.transition,
            body.input,
            userId(c),
            body.requestId,
            body.expectVersion,
          );
        const updated = await service.find(c.get('requestPolicy'), row.id);
        return c.json({ data: (await service.present([updated]))[0] });
      },
    );

    router.route('/requests', requests);
    return router;
  });
