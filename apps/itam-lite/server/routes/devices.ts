import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import type { Application } from '@nocobase/app-server/application';
import {
  defineApiRoutes,
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
import type { RepositoryPolicy } from '@nocobase/db';
import { deviceServiceToken } from '../providers/devices.js';
import { deviceError } from '../devices/service.js';
import type { DeviceAction } from '../devices/permissions.js';
import {
  deviceId,
  deviceInput,
  deviceSchema,
  listDevices,
  listPeople,
} from '../devices/schemas.js';

type Env = {
  Variables: AuthorizationEnv['Variables'] & { devicePolicy: RepositoryPolicy };
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

export const deviceRoutes: AppApiRouteContribution<Application> =
  defineApiRoutes((app) => {
    const router = new Hono();
    const devices = new Hono<Env>();
    const auth = app.container.resolve(authenticationToken);
    const authz = app.container.resolve(authorizationToken);
    const service = app.container.resolve(deviceServiceToken);
    devices.use('*', auth.required(), authz.middleware());
    // Authorization runs before the validators, so a person without the action learns nothing about the input.
    const gate =
      (action: DeviceAction): MiddlewareHandler<Env> =>
      async (c, next) => {
        c.set('devicePolicy', await service.policy(c.get('authz'), action));
        await next();
      };

    devices.get(
      '/',
      gate('read'),
      describeRoute({
        tags: ['Devices'],
        operationId: 'listDevices',
        summary: 'List the devices the person may see',
        responses: {
          '200': listResponse(deviceSchema, meta),
          ...apiErrorResponses,
        },
      }),
      apiValidator('query', listDevices),
      async (c) =>
        c.json(
          await service.list(
            c.get('devicePolicy'),
            c.req.valid('query'),
            c.get('authz'),
          ),
        ),
    );

    devices.get(
      '/people',
      async (c, next) => {
        const policies = await Promise.all(
          (['create', 'edit'] as const).map((action) =>
            service.optionalPolicy(c.get('authz'), action),
          ),
        );
        if (!policies.some(Boolean))
          throw deviceError('PERMISSION_DENIED', 'DEVICE_ACTION_DENIED');
        await next();
      },
      describeRoute({
        tags: ['Devices'],
        operationId: 'listDeviceAssignees',
        summary: 'List the people a device can be assigned to',
        responses: {
          '200': listResponse(
            z.object({ id: z.string(), name: z.string() }),
            meta,
          ),
          ...apiErrorResponses,
        },
      }),
      apiValidator('query', listPeople),
      async (c) => c.json(await service.people(c.req.valid('query'))),
    );

    devices.get(
      '/:id',
      gate('read'),
      describeRoute({
        tags: ['Devices'],
        operationId: 'getDevice',
        summary: 'Read one device',
        responses: { '200': dataResponse(deviceSchema), ...errors },
      }),
      apiValidator('param', deviceId),
      async (c) => {
        const row = await service.find(
          c.get('devicePolicy'),
          c.req.valid('param').id,
        );
        return c.json({
          data: (await service.present([row], c.get('authz')))[0],
        });
      },
    );

    devices.post(
      '/',
      gate('create'),
      describeRoute({
        tags: ['Devices'],
        operationId: 'createDevice',
        summary: 'Register a device',
        responses: { '201': dataResponse(deviceSchema), ...errors },
      }),
      apiValidator('json', deviceInput),
      async (c) => {
        const row = await service.create(
          c.get('devicePolicy'),
          c.req.valid('json'),
        );
        return c.json(
          { data: (await service.present([row], c.get('authz')))[0] },
          201,
        );
      },
    );

    devices.put(
      '/:id',
      gate('edit'),
      describeRoute({
        tags: ['Devices'],
        operationId: 'updateDevice',
        summary: 'Update a device',
        responses: { '200': dataResponse(deviceSchema), ...errors },
      }),
      apiValidator('param', deviceId),
      apiValidator('json', deviceInput),
      async (c) => {
        const row = await service.update(
          c.get('devicePolicy'),
          c.req.valid('param').id,
          c.req.valid('json'),
        );
        return c.json({
          data: (await service.present([row], c.get('authz')))[0],
        });
      },
    );

    devices.delete(
      '/:id',
      gate('delete'),
      describeRoute({
        tags: ['Devices'],
        operationId: 'deleteDevice',
        summary: 'Delete a device',
        responses: {
          '200': dataResponse(z.object({ id: z.string() })),
          ...errors,
        },
      }),
      apiValidator('param', deviceId),
      async (c) => {
        const row = await service.remove(
          c.get('devicePolicy'),
          c.req.valid('param').id,
        );
        return c.json({ data: { id: row.id } });
      },
    );

    router.route('/devices', devices);
    return router;
  });
