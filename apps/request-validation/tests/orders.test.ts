import { expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { createAppTest } from '@nocobase/app-testing/server';
import { signIn } from '@nocobase/app-plugin-authentication/testing';
import { databaseManagerToken } from '@nocobase/db';
import {
  apiErrorHandler,
  findUndeclaredApiRoutes,
} from '@nocobase/app-server/router';
import { ApiClientError, createApiClient } from '@nocobase/api-client';
import { createStandaloneServer } from '../server/standalone.js';
import { createFixtures, ids } from '../scripts/fixtures.js';
import { orderServiceToken } from '../server/providers/orders.js';
import { errorSummary } from '../scripts/client-errors.js';

const test = createAppTest({
  createServer: createStandaloneServer,
  scope: 'test',
  connections: ['main'],
  config: {
    logging: { enabled: false },
    app: { publicOrigin: 'http://localhost' },
    auth: { secret: 'validation-test-secret-at-least-32-characters' },
  },
});
const json = (body: unknown, method = 'PATCH'): RequestInit => ({
  method,
  headers: { origin: 'http://localhost', 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
const validOrder = {
  customerId: ids.customer,
  reference: '  SO-2000  ',
  items: [{ name: '  Keyboard  ', quantity: 2 }],
  note: 'Keep this note',
};

test('normalizes input, persists creation, preserves omitted fields and clears an explicit null', async ({
  testApp,
}) => {
  const fixture = await createFixtures(
    testApp.application,
    'test-password-123456',
  );
  const editor = await signIn(testApp, {
    email: fixture.editor.email,
    password: fixture.password,
  });
  const created = await editor.fetch('/orders', json(validOrder, 'POST'));
  expect(created.status).toBe(201);
  const body = (await created.json()) as { data: { id: string } };
  expect(body).toMatchObject({
    data: {
      reference: 'SO-2000',
      items: [{ name: 'Keyboard', quantity: 2 }],
      status: 'draft',
    },
  });
  const path = `/orders/${body.data.id}`;
  expect(
    await (await editor.fetch(path, json({ reference: 'Updated' }))).json(),
  ).toMatchObject({ data: { note: 'Keep this note' } });
  expect(
    await (await editor.fetch(path, json({ note: null }))).json(),
  ).toMatchObject({ data: { note: null } });
  expect(
    await testApp.application.container
      .resolve(databaseManagerToken)
      .repository('orders')
      .findOne({ filter: { id: body.data.id } }),
  ).toMatchObject({ reference: 'Updated', note: null });
  const list = await editor.fetch('/orders?page=1&pageSize=1');
  const page = (await list.json()) as { data: unknown[]; meta: unknown };
  expect(page.data).toHaveLength(1);
  expect(page.meta).toEqual({ page: 1, pageSize: 1, total: 3 });
  expect(await (await editor.fetch('/orders')).json()).toMatchObject({
    meta: { page: 1, pageSize: 20 },
  });
});

test('rejects invalid fields before writing and reports nested and object-level paths', async ({
  testApp,
}) => {
  const fixture = await createFixtures(
    testApp.application,
    'test-password-123456',
  );
  const editor = await signIn(testApp, {
    email: fixture.editor.email,
    password: fixture.password,
  });
  const database = testApp.application.container.resolve(databaseManagerToken);
  const before = await database
    .repository('orders')
    .findMany({ sort: (s) => [s.field('id').asc()] });
  for (const [input, field] of [
    [{ reference: '  ' }, 'reference'],
    [{ reference: 'a'.repeat(121) }, 'reference'],
    [{ customerId: 'invalid' }, 'customerId'],
    [{ items: [{ name: 'Keyboard', quantity: 0 }] }, 'items.0.quantity'],
    [{ items: [{ name: 'Keyboard', quantity: '2' }] }, 'items.0.quantity'],
    [{ status: 'confirmed' }, ''],
    [{}, ''],
  ] as const) {
    const response = await editor.fetch(`/orders/${ids.draft}`, json(input));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        status: 'INVALID_ARGUMENT',
        reason: 'INVALID_INPUT',
        domain: 'app',
        fieldViolations: expect.arrayContaining([
          expect.objectContaining({ field }),
        ]),
      },
    });
  }
  expect((await editor.fetch('/orders', json({}, 'POST'))).status).toBe(400);
  for (const query of [
    'page=0',
    'page=-1',
    'page=1000001',
    'page=abc',
    'pageSize=101',
  ]) {
    expect((await editor.fetch(`/orders?${query}`)).status).toBe(400);
  }
  expect((await editor.fetch('/orders/not-a-uuid')).status).toBe(400);
  expect(
    await database
      .repository('orders')
      .findMany({ sort: (s) => [s.field('id').asc()] }),
  ).toEqual(before);
});

test('distinguishes malformed JSON from schema validation', async ({
  testApp,
}) => {
  const fixture = await createFixtures(
    testApp.application,
    'test-password-123456',
  );
  const editor = await signIn(testApp, {
    email: fixture.editor.email,
    password: fixture.password,
  });
  const response = await editor.fetch('/orders', {
    ...json({}, 'POST'),
    body: '{',
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    error: { reason: 'HTTP_400', status: 'INVALID_ARGUMENT', domain: 'app' },
  });
  expect(
    await testApp.application.container
      .resolve(databaseManagerToken)
      .repository('orders')
      .count(),
  ).toBe(2);
});

test('reports missing orders, invalid customers and locked orders without changing data', async ({
  testApp,
}) => {
  const fixture = await createFixtures(
    testApp.application,
    'test-password-123456',
  );
  const editor = await signIn(testApp, {
    email: fixture.editor.email,
    password: fixture.password,
  });
  const database = testApp.application.container.resolve(databaseManagerToken);
  const before = await database
    .repository('orders')
    .findMany({ sort: (s) => [s.field('id').asc()] });
  for (const method of ['POST', 'PATCH']) {
    const response = await editor.fetch(
      method === 'POST' ? '/orders' : `/orders/${ids.draft}`,
      json({ ...validOrder, customerId: ids.missing }, method),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        reason: 'CUSTOMER_UNAVAILABLE',
        domain: 'orders',
        fieldViolations: [{ field: 'customerId' }],
      },
    });
  }
  const missing = await editor.fetch(
    `/orders/${ids.missing}`,
    json({ note: null }),
  );
  expect(missing.status).toBe(404);
  expect(await missing.json()).toMatchObject({
    error: { reason: 'ORDER_NOT_FOUND' },
  });
  const locked = await editor.fetch(
    `/orders/${ids.confirmed}`,
    json({ note: null }),
  );
  expect(locked.status).toBe(400);
  expect(await locked.json()).toMatchObject({
    error: { status: 'FAILED_PRECONDITION', reason: 'ORDER_LOCKED' },
  });
  expect(
    await database
      .repository('orders')
      .findMany({ sort: (s) => [s.field('id').asc()] }),
  ).toEqual(before);
});

test('checks authentication and permission before input and existence', async ({
  testApp,
}) => {
  const fixture = await createFixtures(
    testApp.application,
    'test-password-123456',
  );
  const reader = await signIn(testApp, {
    email: fixture.reader.email,
    password: fixture.password,
  });
  const database = testApp.application.container.resolve(databaseManagerToken);
  const before = await database
    .repository('orders')
    .findMany({ sort: (s) => [s.field('id').asc()] });
  expect(
    (await testApp.request('/orders/not-a-uuid', json({ status: 'confirmed' })))
      .status,
  ).toBe(401);
  for (const id of ['not-a-uuid', ids.draft, ids.missing]) {
    const response = await reader.fetch(
      `/orders/${id}`,
      json({ status: 'confirmed' }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { reason: 'ORDER_ACTION_DENIED' },
    });
  }
  expect((await reader.fetch('/orders')).status).toBe(200);
  expect(
    await database
      .repository('orders')
      .findMany({ sort: (s) => [s.field('id').asc()] }),
  ).toEqual(before);
});

test('passes real Repository errors through the handler, including on a bare Hono router', async ({
  testApp,
}) => {
  const fixture = await createFixtures(
    testApp.application,
    'test-password-123456',
  );
  const editor = await signIn(testApp, {
    email: fixture.editor.email,
    password: fixture.password,
  });
  const service = testApp.application.container.resolve(orderServiceToken);
  const update = service.update.bind(service);
  // Isolate a stricter downstream policy while keeping a real Repository write.
  const spy = vi
    .spyOn(service, 'update')
    .mockImplementation((policies, id, input) =>
      update(
        { ...policies, orders: { ...policies.orders, update: false } },
        id,
        input,
      ),
    );
  try {
    const response = await editor.fetch(
      `/orders/${ids.draft}`,
      json({ note: null }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { reason: 'WRITE_FORBIDDEN', domain: 'app' },
    });
  } finally {
    spy.mockRestore();
  }
  const database = testApp.application.container.resolve(databaseManagerToken);
  expect(
    await database.repository('orders').findOne({ filter: { id: ids.draft } }),
  ).toMatchObject({ note: 'Deliver in the morning.' });
  const router = new Hono();
  router.onError(apiErrorHandler);
  router.patch('/missing', async (c) =>
    c.json(
      await database
        .repository('orders')
        .updateOne({ filter: { id: randomUUID() }, values: { note: null } }),
    ),
  );
  expect(
    await (await router.request('/missing', { method: 'PATCH' })).json(),
  ).toMatchObject({
    error: { code: 404, reason: 'RECORD_NOT_FOUND', domain: 'app' },
  });
});

test('hides unexpected failures, preserves request IDs and exposes field details through ApiClientError.payload', async ({
  testApp,
}) => {
  const fixture = await createFixtures(
    testApp.application,
    'test-password-123456',
  );
  const editor = await signIn(testApp, {
    email: fixture.editor.email,
    password: fixture.password,
  });
  const api = createApiClient({
    baseURL: '/main/api',
    fetch: ((url, init) =>
      editor.fetch(String(url).replace('/main/api', ''), init)) as typeof fetch,
    headers: { origin: 'http://localhost', 'x-request-id': 'validation-demo' },
  });
  try {
    await api.request({
      method: 'PATCH',
      path: `orders/${ids.draft}`,
      json: { items: [{ name: 'Keyboard', quantity: 0 }] },
    });
    throw new Error('Expected a validation error');
  } catch (error) {
    expect(error).toBeInstanceOf(ApiClientError);
    expect(errorSummary(error)).toMatchObject({
      status: 400,
      reason: 'INVALID_INPUT',
      domain: 'app',
      requestId: 'validation-demo',
      fields: [{ field: 'items.0.quantity' }],
    });
  }
  const service = testApp.application.container.resolve(orderServiceToken);
  const spy = vi
    .spyOn(service, 'update')
    .mockRejectedValue(new Error('private-database-details'));
  try {
    const response = await editor.fetch(`/orders/${ids.draft}`, {
      ...json({ note: null }),
      headers: { ...json({}).headers, 'x-request-id': 'validation-demo' },
    });
    expect(response.status).toBe(500);
    expect(response.headers.get('x-request-id')).toBe('validation-demo');
    const body = await response.json();
    expect(body).toMatchObject({
      error: {
        status: 'INTERNAL',
        reason: 'INTERNAL_ERROR',
        requestId: 'validation-demo',
      },
    });
    expect(JSON.stringify(body)).not.toContain('private-database-details');
    expect(
      await testApp.application.container
        .resolve(databaseManagerToken)
        .repository('orders')
        .findOne({ filter: { id: ids.draft } }),
    ).toMatchObject({ note: 'Deliver in the morning.' });
  } finally {
    spy.mockRestore();
  }
});

test('documents inputs, generated validation errors and explicit business failures', async ({
  testApp,
}) => {
  const fixture = await createFixtures(
    testApp.application,
    'test-password-123456',
  );
  const editor = await signIn(testApp, {
    email: fixture.editor.email,
    password: fixture.password,
  });
  expect(
    findUndeclaredApiRoutes(testApp.application).filter((route) =>
      route.path.includes('/orders'),
    ),
  ).toEqual([]);
  const response = await editor.fetch('/swagger');
  expect(response.status).toBe(200);
  const document = (await response.json()) as {
    paths: Record<
      string,
      Record<
        string,
        {
          operationId?: string;
          responses: Record<string, unknown>;
          parameters?: unknown[];
        }
      >
    >;
  };
  const operations = Object.values(document.paths).flatMap((path) =>
    Object.values(path),
  );
  const list = operations.find(
    (operation) => operation.operationId === 'ordersListOrders',
  )!;
  expect(list.responses['400']).toEqual({
    $ref: '#/components/responses/InvalidInput',
  });
  expect(list.parameters).toHaveLength(2);
  const update = operations.find(
    (operation) => operation.operationId === 'ordersUpdateOrder',
  )!;
  expect(JSON.stringify(update.responses['400'])).toContain('INVALID_INPUT');
  expect(JSON.stringify(update.responses['400'])).toContain('ORDER_LOCKED');
  expect(update.responses).toHaveProperty('404');
});
