import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { createAppTest } from '@nocobase/app-testing/server';
import {
  signIn,
  DEFAULT_ADMIN_CREDENTIALS,
} from '@nocobase/app-plugin-authentication/testing';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { createStandaloneServer } from '../../server/standalone.js';
import type { DeviceRequest } from '../../server/requests/schemas.js';

const test = createAppTest({
  createServer: createStandaloneServer,
  connections: ['main'],
  config: {
    logging: { enabled: false },
    app: { publicOrigin: 'http://localhost' },
    auth: { secret: 'test-auth-secret-at-least-32-characters' },
  },
});

const operationKey = () => `${Date.now()}.${randomUUID()}`;
const json = (
  method: string,
  data: unknown,
  headers: Record<string, string> = {},
) => ({
  method,
  headers: {
    'content-type': 'application/json',
    origin: 'http://localhost',
    // Every write is a new operation unless a test repeats one on purpose.
    ...(method === 'GET' ? {} : { 'Idempotency-Key': operationKey() }),
    ...headers,
  },
  body: JSON.stringify(data),
});
type Session = Awaited<ReturnType<typeof signIn>>;

async function person(
  testApp: Parameters<typeof signIn>[0],
  admin: Session,
  name: string,
  role: string,
) {
  const id = `${name}-${randomUUID().slice(0, 8)}`;
  const credentials = {
    email: `${id}@example.test`,
    password: `${name}-test-password`,
  };
  expect(
    (
      await admin.fetch(
        '/users',
        json(
          'POST',
          { ...credentials, name: id },
          // User management is a standard write: it needs an operation key.
          { 'Idempotency-Key': operationKey() },
        ),
      )
    ).status,
  ).toBe(201);
  const session = await signIn(testApp, credentials);
  await testApp.application.container
    .resolve(authorizationToken)
    .permissionSets.assign({
      permissionSet: role,
      subject: { type: 'user', id: session.user.id },
    });
  return session;
}
const submit = async (session: Session, category: string) =>
  (
    (await (
      await session.fetch(
        '/requests',
        json(
          'POST',
          { category, reason: 'Needed for work' },
          { 'Idempotency-Key': operationKey() },
        ),
      )
    ).json()) as { data: DeviceRequest }
  ).data;
const fire = (session: Session, id: string, body: Record<string, unknown>) =>
  session.fetch(`/requests/${id}/fire`, json('POST', body));

// docs/design.md §6, checked through the API with ordinary accounts: what the pages hide, the server refuses.
test('limits each role to its own records and actions, whatever the page shows', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const alice = await person(testApp, admin, 'alice', 'employee');
  const dave = await person(testApp, admin, 'dave', 'employee');
  const ben = await person(testApp, admin, 'ben', 'it-support');
  const cathy = await person(testApp, admin, 'cathy', 'asset-manager');

  const mine = await submit(alice, 'laptop');
  const others = await submit(dave, 'phone');
  const ids = async (session: Session, path: string) =>
    (
      (await (await session.fetch(path)).json()) as { data: { id: string }[] }
    ).data.map((row) => row.id);

  // Employees: their own requests only; another's is not found, not forbidden, so ids do not leak.
  expect(await ids(alice, '/requests')).toEqual([mine.id]);
  expect((await alice.fetch(`/requests/${others.id}`)).status).toBe(404);
  expect(
    (await fire(alice, others.id, { transition: 'withdraw' })).status,
  ).toBe(404);
  expect((await fire(alice, mine.id, { transition: 'approve' })).status).toBe(
    403,
  );
  expect(
    (
      await fire(alice, mine.id, {
        transition: 'issue',
        input: { deviceId: randomUUID() },
      })
    ).status,
  ).toBe(403);
  // IT support and asset managers see everyone's requests.
  expect(await ids(ben, '/requests')).toEqual(
    expect.arrayContaining([mine.id, others.id]),
  );
  expect(await ids(cathy, '/requests')).toEqual(
    expect.arrayContaining([mine.id, others.id]),
  );

  // The detail page learns which of the next steps the role allows.
  const can = async (session: Session, id: string) =>
    (
      (await (await session.fetch(`/requests/${id}`)).json()) as {
        data: { can: Record<string, boolean> };
      }
    ).data.can;
  expect(await can(alice, mine.id)).toEqual({
    approve: false,
    issue: false,
    withdraw: true,
  });
  expect(await can(ben, mine.id)).toEqual({
    approve: false,
    issue: true,
    withdraw: true,
  });
  expect(await can(cathy, mine.id)).toEqual({
    approve: true,
    issue: false,
    withdraw: true,
  });
  // A button shown by mistake still meets the server: IT support cannot approve, asset managers cannot issue.
  expect((await fire(ben, mine.id, { transition: 'approve' })).status).toBe(
    403,
  );
  expect((await fire(cathy, mine.id, { transition: 'approve' })).status).toBe(
    200,
  );
  expect(
    (
      await fire(cathy, mine.id, {
        transition: 'issue',
        input: { deviceId: randomUUID() },
      })
    ).status,
  ).toBe(403);

  // Devices: employees read only what is assigned to them and change nothing.
  const create = (
    session: Session,
    assetTag: string,
    extra: Record<string, unknown> = {},
  ) =>
    session.fetch(
      '/devices',
      json('POST', { assetTag, name: assetTag, category: 'laptop', ...extra }),
    );
  expect(
    (
      await create(cathy, 'IT-R-1', {
        status: 'inUse',
        assigneeId: alice.user.id,
      })
    ).status,
  ).toBe(201);
  expect((await create(ben, 'IT-R-2')).status).toBe(201);
  expect((await create(alice, 'IT-R-3')).status).toBe(403);
  const aliceDevices = (await (await alice.fetch('/devices')).json()) as {
    data: {
      id: string;
      assetTag: string;
      permissions: { edit: boolean; delete: boolean };
    }[];
  };
  expect(aliceDevices.data.map((row) => row.assetTag)).toEqual(['IT-R-1']);
  expect(aliceDevices.data[0].permissions).toEqual({
    edit: false,
    delete: false,
  });
  const deviceId = aliceDevices.data[0].id;
  expect(
    (
      await alice.fetch(
        `/devices/${deviceId}`,
        json('PUT', {
          assetTag: 'IT-R-1',
          name: 'Mine now',
          category: 'laptop',
        }),
      )
    ).status,
  ).toBe(403);
  // IT support edits but does not delete; asset managers delete.
  const del = (session: Session, id: string) =>
    session.fetch(`/devices/${id}`, {
      method: 'DELETE',
      headers: { origin: 'http://localhost' },
    });
  expect((await del(ben, deviceId)).status).toBe(403);
  const spare = (
    (await (await ben.fetch('/devices?q=IT-R-2')).json()) as {
      data: { id: string }[];
    }
  ).data[0].id;
  expect((await del(cathy, spare)).status).toBe(200);

  // Only administrators manage the workflow.
  for (const session of [alice, ben, cathy])
    expect((await session.fetch('/workflows/definitions')).status).toBe(403);
});
