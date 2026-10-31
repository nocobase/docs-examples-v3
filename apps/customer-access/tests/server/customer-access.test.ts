import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { createAppTest } from '@nocobase/app-testing/server';
import { signIn } from '@nocobase/app-plugin-authentication/testing';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { definePermissionSet } from '@nocobase/authorization/permission-sets';
import { selection } from '@nocobase/authorization/core';
import { createStandaloneServer } from '../../server/standalone.js';
import { accessResource } from '../../server/access/permissions.js';
import {
  authorizeAccess,
  type AccessEnv,
} from '../../server/access/authorize.js';
import { Hono } from 'hono';
const test = createAppTest({
  createServer: createStandaloneServer,
  server: { basePath: '/access' },
  config: {
    app: { publicOrigin: 'http://localhost' },
    auth: {
      secret: 'customer-access-test-secret-at-least-32-characters',
      trustedOrigins: ['http://localhost'],
      emailAndPassword: { disableSignUp: false },
    },
  },
});
const key = () => `${Date.now()}.${randomUUID()}`;
const write = (
  value: unknown,
  method = 'POST',
  operation = key(),
): RequestInit => ({
  method,
  headers: {
    'Content-Type': 'application/json',
    Origin: 'http://localhost',
    'Idempotency-Key': operation,
  },
  body: JSON.stringify(value),
});
const credentialsFor = () => ({
  name: 'Alice Example',
  email: `alice-${randomUUID()}@example.test`,
  password: 'isolated-test-alice-password',
});

test('authentication, explicit actions, owned records, hidden fields and persistent edits', async ({
  request,
  testApp,
  app,
  connection,
}) => {
  const credentials = credentialsFor();
  expect((await request('/customers')).status).toBe(401);
  expect(
    (await request('/auth/sign-up/email', write(credentials))).status,
  ).toBe(200);
  const alice = await signIn(testApp, credentials);
  expect((await alice.fetch('/customers')).status).toBe(403);
  const authz = app.container.resolve(authorizationToken);
  // Page access alone never authorizes the business API.
  await authz.permissionSets.create(
    definePermissionSet('page-only')
      .title('Page only')
      .grant({
        resource: { type: 'page', id: 'customerAccess.customers' },
        actions: [{ action: 'access' }],
      })
      .build(),
  );
  await authz.permissionSets.assign({
    permissionSet: 'page-only',
    subject: { type: 'user', id: alice.user.id },
  });
  expect((await alice.fetch('/customers')).status).toBe(403);
  await authz.permissionSets.assign({
    permissionSet: 'customer-sales',
    subject: { type: 'user', id: alice.user.id },
  });
  const ownId = randomUUID(),
    otherId = randomUUID();
  for (const [id, ownerId, name] of [
    [ownId, alice.user.id, 'Acme Supplies'],
    [otherId, 'bob', 'Hidden customer'],
  ])
    await connection.repository('accessCustomers').createOne({
      values: {
        id,
        ownerId,
        name,
        email: 'contact@example.test',
        notes: 'Call next week',
        internalNote: 'Private margin',
      },
    });
  const list = await alice.fetch('/customers?page=1&pageSize=1');
  expect(await list.json()).toMatchObject({
    data: [{ id: ownId }],
    meta: { total: 1 },
  });
  const read = await alice.fetch(`/customers/${ownId}`);
  const body = await read.json();
  expect(body.data).not.toHaveProperty('internalNote');
  expect((await alice.fetch(`/customers/${otherId}`)).status).toBe(404);
  expect((await alice.fetch(`/customers/${randomUUID()}`)).status).toBe(404);
  const values = {
    name: 'Acme Updated',
    email: 'new@example.test',
    notes: 'Saved',
  };
  expect(
    (await alice.fetch(`/customers/${ownId}`, write(values, 'PATCH'))).status,
  ).toBe(200);
  expect(
    await connection
      .repository('accessCustomers')
      .findOne({ filter: { id: ownId } }),
  ).toMatchObject({
    ...values,
    ownerId: alice.user.id,
    internalNote: 'Private margin',
  });
  expect(
    (await alice.fetch(`/customers/${otherId}`, write(values, 'PATCH'))).status,
  ).toBe(404);
  for (const forbidden of [{ ownerId: 'bob' }, { internalNote: 'changed' }])
    expect(
      (
        await alice.fetch(
          `/customers/${ownId}`,
          write({ ...values, ...forbidden }, 'PATCH'),
        )
      ).status,
    ).toBe(400);
  const operation = key();
  const created = await alice.fetch(
    '/customers',
    write({ ...values, name: 'New client' }, 'POST', operation),
  );
  expect(created.status).toBe(201);
  expect((await created.json()).data).toMatchObject({
    ownerId: alice.user.id,
    name: 'New client',
  });
  const replay = await alice.fetch(
    '/customers',
    write({ ...values, name: 'New client' }, 'POST', operation),
  );
  expect(replay.headers.get('Idempotency-Replayed')).toBe('true');
  expect(
    await connection
      .repository('accessCustomers')
      .count({ filter: { name: 'New client' } }),
  ).toBe(1);
  // Policy itself, independently of HTTP input validation, rejects forbidden fields.
  const context = await authz.for({
    principal: { type: 'user', id: alice.user.id },
  });
  const decision = await context.authorize({
    resource: { type: 'composite', id: 'customerAccess' },
    action: 'editCustomer',
  });
  const scoped = connection
    .repository('accessCustomers')
    .withPolicy(decision.conditions!.database!.accessCustomers);
  await expect(
    scoped.updateOne({ filter: { id: ownId }, values: { ownerId: 'bob' } }),
  ).rejects.toThrow();
  const projected = await scoped.findOne({ filter: { id: ownId } });
  expect(projected).not.toHaveProperty('internalNote');
  const role = await authz.permissionSets.get('customer-sales');
  await authz.permissionSets.update('customer-sales', { ...role!, grants: [] });
  expect((await alice.fetch('/customers')).status).toBe(403);
  expect(
    (await alice.fetch('/customers', write(values, 'POST', operation))).status,
  ).toBe(403);
  await authz.permissionSets.update('customer-sales', role!);
});

test('assignment checks both collections, rejects invisible targets and keeps failed writes unchanged', async ({
  request,
  testApp,
  app,
  connection,
}) => {
  const credentials = credentialsFor();
  await request('/auth/sign-up/email', write(credentials));
  const alice = await signIn(testApp, credentials);
  const authz = app.container.resolve(authorizationToken);
  await authz.permissionSets.assign({
    permissionSet: 'customer-sales',
    subject: { type: 'user', id: alice.user.id },
  });
  const first = randomUUID(),
    next = randomUUID(),
    hidden = randomUUID(),
    orderId = randomUUID(),
    hiddenOrder = randomUUID();
  for (const [id, ownerId] of [
    [first, alice.user.id],
    [next, alice.user.id],
    [hidden, 'bob'],
  ])
    await connection.repository('accessCustomers').createOne({
      values: {
        id,
        ownerId,
        name: 'Customer',
        email: 'customer@example.test',
        notes: '',
        internalNote: '',
      },
    });
  for (const [id, ownerId] of [
    [orderId, alice.user.id],
    [hiddenOrder, 'bob'],
  ])
    await connection.repository('accessOrders').createOne({
      values: { id, ownerId, number: 'SO-1001', customerId: first },
    });
  const options = await alice.fetch('/orders/customerOptions');
  expect(
    (await options.json()).data.map((r: { id: string }) => r.id).sort(),
  ).toEqual([first, next].sort());
  for (const customerId of [hidden, randomUUID()]) {
    const response = await alice.fetch(
      `/orders/${orderId}/assignCustomer`,
      write({ customerId }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { reason: 'CUSTOMER_UNAVAILABLE' },
    });
    expect(
      await connection
        .repository('accessOrders')
        .findOne({ filter: { id: orderId } }),
    ).toMatchObject({ customerId: first });
  }
  for (const id of [hiddenOrder, randomUUID()])
    expect(
      (
        await alice.fetch(
          `/orders/${id}/assignCustomer`,
          write({ customerId: next }),
        )
      ).status,
    ).toBe(404);
  const response = await alice.fetch(
    `/orders/${orderId}/assignCustomer`,
    write({ customerId: next }),
  );
  expect(response.status).toBe(200);
  expect(
    await connection
      .repository('accessOrders')
      .findOne({ filter: { id: orderId } }),
  ).toMatchObject({ customerId: next });
  // Removing either data scope never falls back to another action's view scope.
  const role = await authz.permissionSets.get('customer-sales');
  for (const scopes of [
    { orders: selection.recordAccess('customerAccess.owned') },
    { customers: selection.recordAccess('customerAccess.owned') },
  ]) {
    await authz.permissionSets.update('customer-sales', {
      ...role!,
      grants: [accessResource.reference().grant({ assignCustomer: scopes })],
    });
    expect(
      (
        await alice.fetch(
          `/orders/${orderId}/assignCustomer`,
          write({ customerId: first }),
        )
      ).status,
    ).toBe(403);
    expect(
      await connection
        .repository('accessOrders')
        .findOne({ filter: { id: orderId } }),
    ).toMatchObject({ customerId: next });
  }
  await authz.permissionSets.update('customer-sales', role!);
});

test('reader cannot create, edit or assign; sibling action remains denied', async ({
  request,
  testApp,
  app,
}) => {
  const credentials = credentialsFor();
  await request('/auth/sign-up/email', write(credentials));
  const alice = await signIn(testApp, credentials);
  const authz = app.container.resolve(authorizationToken);
  await authz.permissionSets.assign({
    permissionSet: 'customer-reader',
    subject: { type: 'user', id: alice.user.id },
  });
  expect((await alice.fetch('/customers')).status).toBe(200);
  expect((await alice.fetch('/customers', write({}))).status).toBe(403);
  expect(
    (await alice.fetch(`/customers/${randomUUID()}`, write({}, 'PATCH')))
      .status,
  ).toBe(403);
  expect(
    (await alice.fetch(`/orders/${randomUUID()}/assignCustomer`, write({})))
      .status,
  ).toBe(403);
});

test('missing required policies fail closed even if a decision says allow', async () => {
  const router = new Hono<AccessEnv>();
  router.get('/', async (c) => {
    c.set('authz', {
      authorize: async () => ({
        effect: 'allow',
        conditions: { database: {} },
      }),
    } as never);
    await expect(authorizeAccess(c, 'assignCustomer')).rejects.toMatchObject({
      reason: 'CUSTOMER_ACCESS_DENIED',
    });
    return c.text('checked');
  });
  expect((await router.request('/')).status).toBe(200);
});

test('action-only grants allow scoped API access without granting the page', async ({
  request,
  testApp,
  app,
}) => {
  const credentials = credentialsFor();
  await request('/auth/sign-up/email', write(credentials));
  const user = await signIn(testApp, credentials);
  const authz = app.container.resolve(authorizationToken);
  await authz.permissionSets.create(
    definePermissionSet('action-only')
      .title('Action only')
      .grant(
        accessResource.reference().grant({
          viewCustomers: {
            customers: selection.recordAccess('customerAccess.owned'),
          },
        }),
      )
      .build(),
  );
  await authz.permissionSets.assign({
    permissionSet: 'action-only',
    subject: { type: 'user', id: user.user.id },
  });
  expect((await user.fetch('/customers')).status).toBe(200);
  const context = authz.for({ principal: { type: 'user', id: user.user.id } });
  expect(
    await context.can({
      resource: { type: 'page', id: 'customerAccess.customers' },
      action: 'access',
    }),
  ).toBe(false);
  expect((await user.fetch('/orders')).status).toBe(403);
});
