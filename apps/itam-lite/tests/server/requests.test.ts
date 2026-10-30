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

const json = (
  method: string,
  data: unknown,
  headers: Record<string, string> = {},
) => ({
  method,
  headers: {
    'content-type': 'application/json',
    origin: 'http://localhost',
    ...headers,
  },
  body: JSON.stringify(data),
});
type Session = Awaited<ReturnType<typeof signIn>>;

/** A signed-in person holding one of the seeded roles. */
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
          { 'Idempotency-Key': `${Date.now()}.${randomUUID()}` },
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

const submit = async (session: Session, category: string) => {
  const response = await session.fetch(
    '/requests',
    json(
      'POST',
      { category, reason: 'Needed for work' },
      { 'Idempotency-Key': randomUUID() },
    ),
  );
  expect(response.status).toBe(201);
  return ((await response.json()) as { data: DeviceRequest }).data;
};
const fire = (session: Session, id: string, body: Record<string, unknown>) =>
  session.fetch(
    `/requests/${id}/fire`,
    json('POST', { requestId: randomUUID(), ...body }),
  );

test('routes requests by the approval rules, then approves and issues them', async ({
  testApp,
}) => {
  expect((await testApp.request('/requests')).status).toBe(401);
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const alice = await person(testApp, admin, 'alice', 'employee');
  const cathy = await person(testApp, admin, 'cathy', 'asset-manager');
  const ben = await person(testApp, admin, 'ben', 'it-support');
  const laptop = await submit(alice, 'laptop');
  expect(laptop).toMatchObject({
    status: 'pendingApproval',
    needsApproval: true,
    requesterId: alice.user.id,
  });
  expect(await submit(alice, 'monitor')).toMatchObject({
    status: 'readyToIssue',
    needsApproval: false,
  });

  // An employee holds no approve action; an asset manager cannot decide their own request.
  expect((await fire(alice, laptop.id, { transition: 'approve' })).status).toBe(
    403,
  );
  const own = await submit(cathy, 'phone');
  const ownResponse = await fire(cathy, own.id, { transition: 'approve' });
  expect(ownResponse.status).toBe(403);
  expect(await ownResponse.json()).toMatchObject({
    error: {
      reason: 'GUARD_REJECTED',
      metadata: { blockers: [{ code: 'OWN_REQUEST' }] },
    },
  });
  expect(
    (
      await fire(cathy, own.id, {
        transition: 'reject',
        input: { decisionComment: ' ' },
      })
    ).status,
  ).toBe(400);

  // A stale page is refused rather than overwriting a newer decision.
  expect(
    (await fire(cathy, laptop.id, { transition: 'approve', expectVersion: 0 }))
      .status,
  ).toBe(409);
  const approved = await fire(cathy, laptop.id, {
    transition: 'approve',
    input: { decisionComment: 'OK' },
    expectVersion: laptop.lifecycleVersion,
  });
  expect(approved.status).toBe(200);
  expect(await approved.json()).toMatchObject({
    data: { status: 'readyToIssue', decidedById: cathy.user.id },
  });

  // Issuing is IT support's: the device must be in stock and of the requested category.
  const device = async (assetTag: string, category: string) =>
    (
      (await (
        await admin.fetch(
          '/devices',
          json('POST', { assetTag, name: assetTag, category }),
        )
      ).json()) as { data: { id: string } }
    ).data.id;
  const monitorId = await device('IT-T-M1', 'monitor');
  const laptopId = await device('IT-T-L1', 'laptop');
  expect(
    (
      await fire(cathy, laptop.id, {
        transition: 'issue',
        input: { deviceId: laptopId },
      })
    ).status,
  ).toBe(403);
  const wrong = await fire(ben, laptop.id, {
    transition: 'issue',
    input: { deviceId: monitorId },
  });
  expect(wrong.status).toBe(400);
  expect(await wrong.json()).toMatchObject({
    error: { reason: 'REQUEST_DEVICE_UNAVAILABLE' },
  });
  const issued = await fire(ben, laptop.id, {
    transition: 'issue',
    input: { deviceId: laptopId },
  });
  expect(issued.status).toBe(200);
  expect(await issued.json()).toMatchObject({
    data: { status: 'issued', deviceAssetTag: 'IT-T-L1' },
  });
  expect(
    await (await admin.fetch(`/devices/${laptopId}`)).json(),
  ).toMatchObject({
    data: { status: 'inUse', assigneeId: alice.user.id },
  });

  // The history names every step and who took it.
  const detail = (await (
    await alice.fetch(`/requests/${laptop.id}`)
  ).json()) as {
    data: { view: { history: { transitions: { transition: string }[] } } };
  };
  expect(
    detail.data.view.history.transitions.map((entry) => entry.transition),
  ).toEqual(['$create', 'submit', 'approve', 'issue']);
});

test('lets administrators adjust the approval rules, refusing stale saves and other people', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const alice = await person(testApp, admin, 'alice', 'employee');
  expect((await alice.fetch('/workflows/definitions')).status).toBe(403);
  const path = '/workflows/definitions/deviceRequests/parameters';
  expect(await (await admin.fetch(path)).json()).toMatchObject({
    data: {
      revision: 0,
      origin: 'default',
      values: { approvalCategories: ['laptop', 'phone'], deviceLimit: 2 },
    },
  });
  const save = (expectedRevision: number, values: unknown) =>
    admin.fetch(
      path,
      json('PUT', { values, expectedRevision, requestId: randomUUID() }),
    );
  expect(
    (await save(0, { approvalCategories: ['phone'], deviceLimit: 25 })).status,
  ).toBe(400);
  expect(
    (await save(0, { approvalCategories: ['phone'], deviceLimit: 1 })).status,
  ).toBe(200);
  expect(
    (await save(0, { approvalCategories: [], deviceLimit: 1 })).status,
  ).toBe(409);
  // Laptops no longer need approval; with one device in use, the next request does.
  const first = await submit(alice, 'laptop');
  expect(first.status).toBe('readyToIssue');
  await admin.fetch(
    '/devices',
    json('POST', {
      assetTag: 'IT-T-9',
      name: 'Laptop',
      category: 'laptop',
      status: 'inUse',
      assigneeId: alice.user.id,
    }),
  );
  expect((await submit(alice, 'monitor')).status).toBe('pendingApproval');
  const executions = await admin.fetch(
    '/workflows/executions?workflowId=deviceRequests',
  );
  const listed = (await executions.json()) as { data: { recordId: string }[] };
  expect(listed.data.map((row) => row.recordId)).toContain(first.id);
});

test('keeps the needed-by date and refuses one before today', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const alice = await person(testApp, admin, 'alice', 'employee');
  const ben = await person(testApp, admin, 'ben', 'it-support');
  const post = (neededBy: unknown) =>
    alice.fetch(
      '/requests',
      json(
        'POST',
        { category: 'monitor', reason: 'Second screen', neededBy },
        { 'Idempotency-Key': randomUUID() },
      ),
    );

  const created = await post('2099-12-31');
  expect(created.status).toBe(201);
  const { data } = (await created.json()) as { data: DeviceRequest };
  expect(data.neededBy).toBe('2099-12-31');
  // IT support reads the date it plans the issue by.
  const seen = await ben.fetch(`/requests/${data.id}`);
  expect(
    ((await seen.json()) as { data: { request: DeviceRequest } }).data.request
      .neededBy,
  ).toBe('2099-12-31');

  const past = await post('2020-01-01');
  expect(past.status).toBe(400);
  expect(await past.json()).toMatchObject({
    error: { reason: 'REQUEST_NEEDED_BY_PAST' },
  });
  expect((await post('2099-02-30')).status).toBe(400);
});
