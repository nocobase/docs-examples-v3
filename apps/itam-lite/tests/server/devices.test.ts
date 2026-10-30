import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { createAppTest } from '@nocobase/app-testing/server';
import {
  signIn,
  DEFAULT_ADMIN_CREDENTIALS,
} from '@nocobase/app-plugin-authentication/testing';
import { createStandaloneServer } from '../../server/standalone.js';
import type { Device } from '../../server/devices/schemas.js';

const test = createAppTest({
  createServer: createStandaloneServer,
  connections: ['main'],
  config: {
    logging: { enabled: false },
    app: { publicOrigin: 'http://localhost' },
    auth: { secret: 'test-auth-secret-at-least-32-characters' },
  },
});

const json = (
  method: string,
  data: unknown,
  extra: Record<string, string> = {},
) => ({
  method,
  headers: {
    ...extra,
    'content-type': 'application/json',
    origin: 'http://localhost',
  },
  body: JSON.stringify(data),
});

const laptop = {
  assetTag: 'IT-T-0001',
  name: 'MacBook Pro 14',
  category: 'laptop',
  serialNumber: 'SN-T-1',
  location: 'Shanghai 3F',
};

test('registers, searches, filters, edits and deletes devices', async ({
  testApp,
}) => {
  expect((await testApp.request('/devices')).status).toBe(401);
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  expect(
    (await admin.fetch('/devices', json('POST', { ...laptop, assetTag: ' ' })))
      .status,
  ).toBe(400);
  const created = await admin.fetch('/devices', json('POST', laptop));
  expect(created.status).toBe(201);
  const { data: device } = (await created.json()) as { data: Device };
  expect(device).toMatchObject({
    status: 'inStock',
    assigneeId: null,
    permissions: { edit: true, delete: true },
  });

  await admin.fetch(
    '/devices',
    json('POST', {
      assetTag: 'IT-T-0002',
      name: 'Dell U2723QE',
      category: 'monitor',
      serialNumber: 'SN-T-2',
    }),
  );
  expect(await (await admin.fetch('/devices?q=SN-T-1')).json()).toMatchObject({
    meta: { total: 1 },
  });
  expect(
    await (await admin.fetch('/devices?category=monitor')).json(),
  ).toMatchObject({
    data: [{ assetTag: 'IT-T-0002' }],
    meta: { total: 1 },
  });

  const assigned = await admin.fetch(
    `/devices/${device.id}`,
    json('PUT', { ...laptop, status: 'inUse', assigneeId: admin.user.id }),
  );
  expect(assigned.status).toBe(200);
  expect(await assigned.json()).toMatchObject({
    data: { status: 'inUse', assigneeName: admin.user.name },
  });
  expect(
    await (await admin.fetch('/devices?status=inUse')).json(),
  ).toMatchObject({ meta: { total: 1 } });

  expect(
    (
      await admin.fetch(`/devices/${device.id}`, {
        method: 'DELETE',
        headers: { origin: 'http://localhost' },
      })
    ).status,
  ).toBe(200);
  expect((await admin.fetch(`/devices/${device.id}`)).status).toBe(404);
  expect(await (await admin.fetch('/swagger')).text()).toContain(
    'createDevice',
  );
});

test('names the field when an asset tag, serial number or assignee breaks a rule', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  await admin.fetch('/devices', json('POST', laptop));
  const reason = async (body: unknown) => {
    const response = await admin.fetch('/devices', json('POST', body));
    const { error } = (await response.json()) as {
      error: { reason: string; fieldViolations?: { field: string }[] };
    };
    return [response.status, error.reason, error.fieldViolations?.[0]?.field];
  };
  expect(await reason({ ...laptop, serialNumber: 'other' })).toEqual([
    409,
    'DEVICE_ASSET_TAG_TAKEN',
    'assetTag',
  ]);
  expect(await reason({ ...laptop, assetTag: 'IT-T-0009' })).toEqual([
    409,
    'DEVICE_SERIAL_NUMBER_TAKEN',
    'serialNumber',
  ]);
  expect(
    await reason({
      ...laptop,
      assetTag: 'IT-T-0009',
      serialNumber: null,
      status: 'inUse',
    }),
  ).toEqual([400, 'DEVICE_ASSIGNEE_REQUIRED', 'assigneeId']);
  expect(
    await reason({
      ...laptop,
      assetTag: 'IT-T-0009',
      serialNumber: null,
      assigneeId: admin.user.id,
    }),
  ).toEqual([400, 'DEVICE_ASSIGNEE_NOT_ALLOWED', 'assigneeId']);
  // Devices without a serial number do not collide with each other.
  for (const assetTag of ['IT-T-0010', 'IT-T-0011'])
    expect(
      (
        await admin.fetch(
          '/devices',
          json('POST', { ...laptop, assetTag, serialNumber: '' }),
        )
      ).status,
    ).toBe(201);
});

test('refuses a signed-in person without device permissions', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const credentials = {
    email: 'no-devices@example.test',
    password: 'test-member-password',
  };
  expect(
    (
      await admin.fetch(
        '/users',
        json(
          'POST',
          { ...credentials, name: 'No devices' },
          // User management is a standard write: it needs an operation key.
          { 'Idempotency-Key': `${Date.now()}.${randomUUID()}` },
        ),
      )
    ).status,
  ).toBe(201);
  const member = await signIn(testApp, credentials);
  expect((await member.fetch('/devices')).status).toBe(403);
  expect((await member.fetch('/devices', json('POST', laptop))).status).toBe(
    403,
  );
  expect((await member.fetch('/devices/people')).status).toBe(403);
});
