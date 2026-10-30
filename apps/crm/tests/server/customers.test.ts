import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { createAppTest } from '@nocobase/app-testing/server';
import {
  signIn,
  DEFAULT_ADMIN_CREDENTIALS,
} from '@nocobase/app-plugin-authentication/testing';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { createStandaloneServer } from '../../server/standalone.js';
import type { Customer } from '../../server/customers/schemas.js';
const test = createAppTest({
  createServer: createStandaloneServer,
  connections: ['main'],
  config: {
    logging: { enabled: false },
    app: { publicOrigin: 'http://localhost' },
    auth: { secret: 'test-auth-secret-at-least-32-characters' },
  },
});
const json = (method: string, data: unknown) => ({
  method,
  headers: {
    'content-type': 'application/json',
    origin: 'http://localhost',
    'Idempotency-Key': `${Date.now()}.${randomUUID()}`,
  },
  body: JSON.stringify(data),
});
test('persists CRUD, rejects invalid inputs and stale writes, and declares HTTP operations', async ({
  testApp,
}) => {
  expect((await testApp.request('/customers')).status).toBe(401);
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const bad = await admin.fetch('/customers', json('POST', { title: '  ' }));
  expect(bad.status).toBe(400);
  expect(
    (
      await admin.fetch(
        '/customers',
        json('POST', { title: 'Invalid date', nextFollowUpDate: '2026-02-30' }),
      )
    ).status,
  ).toBe(400);
  const created = await admin.fetch(
    '/customers',
    json('POST', {
      title: '  Northstar Design  ',
      contact: 'sales@example.test',
      salesOwnerId: admin.user.id,
      nextFollowUpDate: '2026-11-01',
    }),
  );
  expect(created.status).toBe(201);
  const { data: customer } = (await created.json()) as { data: Customer };
  expect(customer).toMatchObject({
    title: 'Northstar Design',
    contact: 'sales@example.test',
    status: 'lead',
    salesOwnerName: admin.user.name,
    permissions: { edit: true, progress: true, delete: true },
  });
  const updated = await admin.fetch(
    `/customers/${customer.id}`,
    json('PATCH', {
      title: 'Northstar Design Ltd',
      description: 'Interested in the enterprise plan.',
      contact: 'procurement@example.test',
      salesOwnerId: admin.user.id,
      nextFollowUpDate: '2026-11-02',
      expectedUpdatedAt: customer.updatedAt,
    }),
  );
  expect(await updated.clone().json()).toMatchObject({
    data: {
      title: 'Northstar Design Ltd',
      contact: 'procurement@example.test',
    },
  });
  expect(updated.status).toBe(200);
  const { data: edited } = (await updated.json()) as { data: Customer };
  expect(
    (
      await admin.fetch(
        `/customers/${customer.id}/status`,
        json('PATCH', { status: 'won', expectedUpdatedAt: customer.updatedAt }),
      )
    ).status,
  ).toBe(409);
  const progressed = await admin.fetch(
    `/customers/${customer.id}/status`,
    json('PATCH', {
      status: 'followingUp',
      expectedUpdatedAt: edited.updatedAt,
    }),
  );
  expect(progressed.status).toBe(200);
  const { data: current } = (await progressed.json()) as { data: Customer };
  const list = await admin.fetch(
    '/customers?q=Northstar&status=followingUp&page=1&pageSize=10&orderBy=nextFollowUpDate:asc',
  );
  expect(list.status).toBe(200);
  expect(await list.json()).toMatchObject({
    data: [{ id: customer.id, status: 'followingUp' }],
    meta: { total: 1 },
  });
  expect((await admin.fetch(`/customers/${customer.id}`)).status).toBe(200);
  const removed = await admin.fetch(
    `/customers/${customer.id}?${new URLSearchParams({ expectedUpdatedAt: current.updatedAt })}`,
    {
      method: 'DELETE',
      headers: {
        origin: 'http://localhost',
        'Idempotency-Key': `${Date.now()}.${randomUUID()}`,
      },
    },
  );
  expect(removed.status).toBe(200);
  expect((await admin.fetch(`/customers/${customer.id}`)).status).toBe(404);
  const swagger = await admin.fetch('/swagger');
  expect(swagger.status).toBe(200);
  const spec = await swagger.text();
  expect(spec).toContain('createCustomer');
  expect(spec).toContain('progressCustomer');
});
test('enforces explicit roles, per-record scopes and read-only writes through real requests', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const credentials = {
    email: 'sales-rep@example.test',
    password: 'test-member-password',
  };
  const user = await admin.fetch(
    '/users',
    json('POST', { ...credentials, name: 'Customer member' }),
  );
  expect(user.status).toBe(201);
  const member = await signIn(testApp, credentials);
  expect((await member.fetch('/customers')).status).toBe(403);
  const authz = testApp.application.container.resolve(authorizationToken);
  await authz.permissionSets.assign({
    id: 'member-role',
    permissionSet: 'sales-rep',
    subject: { type: 'user', id: member.user.id },
  });
  const ownResponse = await admin.fetch(
    '/customers',
    json('POST', { title: 'Assigned customer', salesOwnerId: member.user.id }),
  );
  expect(ownResponse.status).toBe(201);
  const { data: own } = (await ownResponse.json()) as { data: Customer };
  const { data: other } = (await (
    await admin.fetch(
      '/customers',
      json('POST', { title: 'Other customer', salesOwnerId: admin.user.id }),
    )
  ).json()) as { data: Customer };
  const mine = await member.fetch('/customers');
  expect(mine.status).toBe(200);
  expect(await mine.json()).toMatchObject({
    data: [
      {
        id: own.id,
        permissions: { edit: false, progress: true, delete: false },
      },
    ],
    meta: { total: 1 },
  });
  expect((await member.fetch(`/customers/${other.id}`)).status).toBe(404);
  expect(
    (
      await member.fetch(
        `/customers/${other.id}/status`,
        json('PATCH', { status: 'won', expectedUpdatedAt: other.updatedAt }),
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await member.fetch(
        `/customers/${own.id}/status`,
        json('PATCH', { status: 'won', expectedUpdatedAt: own.updatedAt }),
      )
    ).status,
  ).toBe(200);
  const readerCredentials = {
    email: 'customer-reader@example.test',
    password: 'test-reader-password',
  };
  await admin.fetch(
    '/users',
    json('POST', { ...readerCredentials, name: 'Customer reader' }),
  );
  const reader = await signIn(testApp, readerCredentials);
  await authz.permissionSets.assign({
    id: 'reader-role',
    permissionSet: 'customer-reader',
    subject: { type: 'user', id: reader.user.id },
  });
  expect((await reader.fetch('/customers')).status).toBe(200);
  for (const [path, method, values] of [
    ['/customers', 'POST', { title: 'Forbidden' }],
    [
      `/customers/${own.id}`,
      'PATCH',
      { title: 'Forbidden', expectedUpdatedAt: own.updatedAt },
    ],
    [
      `/customers/${own.id}/status`,
      'PATCH',
      { status: 'lead', expectedUpdatedAt: own.updatedAt },
    ],
  ] as const)
    expect((await reader.fetch(path, json(method, values))).status).toBe(403);
  expect(
    (
      await reader.fetch(
        `/customers/${own.id}?${new URLSearchParams({ expectedUpdatedAt: own.updatedAt })}`,
        {
          method: 'DELETE',
          headers: {
            origin: 'http://localhost',
            'Idempotency-Key': `${Date.now()}.${randomUUID()}`,
          },
        },
      )
    ).status,
  ).toBe(403);
  expect((await reader.fetch('/customers/salesOwners')).status).toBe(403);
});

test('replays committed writes once, rejects changed input and rechecks revoked access', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const credentials = {
    email: 'replay-member@example.test',
    password: 'test-member-password',
  };
  expect(
    (
      await admin.fetch(
        '/users',
        json('POST', { ...credentials, name: 'Replay member' }),
      )
    ).status,
  ).toBe(201);
  const member = await signIn(testApp, credentials);
  const authz = testApp.application.container.resolve(authorizationToken);
  await authz.permissionSets.assign({
    id: 'replay-role',
    permissionSet: 'sales-rep',
    subject: { type: 'user', id: member.user.id },
  });
  const request = json('POST', {
    title: 'Exactly once',
    salesOwnerId: member.user.id,
  });
  const first = await admin.fetch('/customers', request);
  const original = (await first.json()) as { data: Customer };
  expect(first.status).toBe(201);
  const replay = await admin.fetch('/customers', request);
  expect(replay.headers.get('Idempotency-Replayed')).toBe('true');
  expect(await replay.json()).toEqual(original);
  const changed = await admin.fetch('/customers', {
    ...request,
    body: JSON.stringify({ title: 'Changed input' }),
  });
  expect(changed.status).toBe(409);
  expect(
    await (await admin.fetch('/customers?q=Exactly%20once')).json(),
  ).toMatchObject({
    meta: { total: 1 },
  });
  const progress = json('PATCH', {
    status: 'won',
    expectedUpdatedAt: original.data.updatedAt,
  });
  const path = `/customers/${original.data.id}/status`;
  const progressed = await member.fetch(path, progress);
  expect(progressed.status).toBe(200);
  const second = await member.fetch(path, progress);
  expect(second.headers.get('Idempotency-Replayed')).toBe('true');
  expect(await second.json()).toEqual(await progressed.json());
  await authz.permissionSets.revoke('replay-role');
  expect((await member.fetch(path, progress)).status).toBe(403);
  expect(
    (
      await admin.fetch('/customers', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost',
        },
        body: JSON.stringify({ title: 'Missing key' }),
      })
    ).status,
  ).toBe(400);
});

test('lets an ordinary sales manager manage customers but keeps sales reps limited to status', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const authz = testApp.application.container.resolve(authorizationToken);
  const credentials = {
    email: 'sales-manager@example.test',
    password: 'test-manager-password',
  };
  expect(
    (
      await admin.fetch(
        '/users',
        json('POST', { ...credentials, name: 'Sales manager' }),
      )
    ).status,
  ).toBe(201);
  const manager = await signIn(testApp, credentials);
  await authz.permissionSets.assign({
    id: 'sales-manager-assignment',
    permissionSet: 'sales-manager',
    subject: { type: 'user', id: manager.user.id },
  });
  const repCredentials = {
    email: 'limited-sales@example.test',
    password: 'test-rep-password',
  };
  expect(
    (
      await admin.fetch(
        '/users',
        json('POST', { ...repCredentials, name: 'Limited sales' }),
      )
    ).status,
  ).toBe(201);
  const rep = await signIn(testApp, repCredentials);
  await authz.permissionSets.assign({
    id: 'limited-sales-assignment',
    permissionSet: 'sales-rep',
    subject: { type: 'user', id: rep.user.id },
  });
  const created = await manager.fetch(
    '/customers',
    json('POST', {
      title: 'Harbor Manufacturing',
      contact: 'purchasing@example.test',
      description: 'Arrange a product demonstration.',
      salesOwnerId: rep.user.id,
      nextFollowUpDate: '2026-11-12',
    }),
  );
  expect(created.status).toBe(201);
  const { data: customer } = (await created.json()) as { data: Customer };
  expect((await manager.fetch('/customers/salesOwners')).status).toBe(200);
  expect(
    (
      await rep.fetch(
        '/customers',
        json('POST', { title: 'Forbidden customer' }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await rep.fetch(
        `/customers/${customer.id}`,
        json('PATCH', {
          title: 'Not allowed',
          expectedUpdatedAt: customer.updatedAt,
        }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await rep.fetch(
        `/customers/${customer.id}/status`,
        json('PATCH', {
          status: 'won',
          contact: 'forbidden@example.test',
          expectedUpdatedAt: customer.updatedAt,
        }),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await rep.fetch(
        `/customers/${customer.id}?${new URLSearchParams({ expectedUpdatedAt: customer.updatedAt })}`,
        { method: 'DELETE', headers: json('DELETE', {}).headers },
      )
    ).status,
  ).toBe(403);
  expect(
    await (await manager.fetch(`/customers/${customer.id}`)).json(),
  ).toMatchObject({
    data: {
      title: 'Harbor Manufacturing',
      contact: 'purchasing@example.test',
      status: 'lead',
    },
  });
  const updated = await manager.fetch(
    `/customers/${customer.id}`,
    json('PATCH', {
      title: 'Harbor Manufacturing Ltd',
      salesOwnerId: null,
      expectedUpdatedAt: customer.updatedAt,
    }),
  );
  expect(updated.status).toBe(200);
  const { data: edited } = (await updated.json()) as { data: Customer };
  expect((await rep.fetch(`/customers/${customer.id}`)).status).toBe(404);
  expect(await (await rep.fetch('/customers?q=Harbor')).json()).toMatchObject({
    data: [],
    meta: { total: 0 },
  });
  expect(
    (
      await manager.fetch(
        `/customers/${customer.id}?${new URLSearchParams({ expectedUpdatedAt: edited.updatedAt })}`,
        { method: 'DELETE', headers: json('DELETE', {}).headers },
      )
    ).status,
  ).toBe(200);
});
