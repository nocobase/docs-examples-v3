import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { createAppTest } from '@nocobase/app-testing/server';
import {
  DEFAULT_ADMIN_CREDENTIALS,
  signIn,
} from '@nocobase/app-plugin-authentication/testing';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { definePermissionSet } from '@nocobase/authorization/permission-sets';
import { selection } from '@nocobase/authorization/core';
import { buildFilter } from '@nocobase/repository-input';
import { createApiClient } from '@nocobase/app-client';
import { findUndeclaredApiRoutes } from '@nocobase/app-server/router';
import { createStandaloneServer } from '../../server/standalone.js';
import { loadCategories } from '../../client/catalog-api.js';
import { catalogResource } from '../../server/catalog-resource.js';

const test = createAppTest({
  createServer: createStandaloneServer,
  server: { basePath: '/shop' },
  config: {
    app: { publicOrigin: 'http://localhost' },
    auth: {
      secret: 'catalog-test-secret-at-least-32-characters',
      trustedOrigins: ['http://localhost'],
      emailAndPassword: { disableSignUp: false },
    },
  },
});
const key = () => `${Date.now()}.${randomUUID()}`;
const post = (value: unknown, operation = key()): RequestInit => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'http://localhost',
    'Idempotency-Key': operation,
  },
  body: JSON.stringify(value),
});

test('public Web routes escape data, exclude drafts and preserve the application mount path', async ({
  testApp,
  connection,
}) => {
  await connection.repository('catalogProducts').createOne({
    values: {
      id: randomUUID(),
      name: '<script>alert(1)</script>',
      priceCents: 1234,
      published: true,
    },
  });
  await connection.repository('catalogProducts').createOne({
    values: {
      id: randomUUID(),
      name: 'Private draft',
      priceCents: 100,
      published: false,
    },
  });
  const response = await testApp.fetch(
    new Request('http://localhost/shop/catalog'),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toContain('text/html');
  const html = await response.text();
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>alert(1)');
  expect(html).not.toContain('Private draft');
  expect(html).toContain('href="/shop/catalog/export.csv"');
  const redirect = await testApp.fetch(
    new Request('http://localhost/shop/old-catalog'),
  );
  expect(redirect.status).toBe(302);
  expect(redirect.headers.get('Location')).toBe('/shop/catalog');
  expect(
    (await testApp.fetch(new Request('http://localhost/catalog'))).status,
  ).toBe(404);
});

test('Repository routes are anonymous read-only, constrain fields and limits, and work through API Client', async ({
  request,
  connection,
  testApp,
}) => {
  await connection.repository('catalogCategories').createOne({
    values: { id: 'office', title: 'Office', internalNote: 'secret' },
  });
  const list = await request('/publicCategories/findMany', post({ limit: 20 }));
  expect(list.status).toBe(200);
  expect(await list.json()).toEqual({
    data: [{ id: 'office', title: 'Office' }],
  });
  expect(
    (await request('/publicCategories/findMany', post({ limit: 51 }))).status,
  ).toBe(400);
  expect(
    (
      await request(
        '/publicCategories/createOne',
        post({ values: { id: 'x' } }),
      )
    ).status,
  ).toBe(404);
  const api = createApiClient({
    baseURL: 'http://localhost/shop/api',
    fetch: (input, init) => testApp.fetch(new Request(input, init)),
  });
  const records = await loadCategories(api);
  expect(records).toEqual([{ id: 'office', title: 'Office' }]);
  expect(await api.repository('publicCategories').count()).toBe(1);
  expect(
    await api
      .repository('publicCategories')
      .findOne({ filter: { id: 'office' } }),
  ).toEqual({ id: 'office', title: 'Office' });
  expect(
    await api
      .repository('publicCategories')
      .findOne({ filter: { id: 'missing' } }),
  ).toBeUndefined();
});

test('custom APIs validate input, persist drafts, publish and replay writes without duplication', async ({
  testApp,
  connection,
  request,
}) => {
  expect((await request('/products')).status).toBe(401);
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const values = { name: 'Catalog test lamp', priceCents: 3500 };
  const operation = key();
  const created = await admin.fetch('/products', post(values, operation));
  expect(created.status).toBe(201);
  const { data } = await created.json();
  expect(data).toMatchObject({ ...values, published: false });
  const repeated = await admin.fetch('/products', post(values, operation));
  expect(repeated.status).toBe(201);
  expect(repeated.headers.get('Idempotency-Replayed')).toBe('true');
  expect(
    await connection
      .repository('catalogProducts')
      .count({ filter: { name: values.name } }),
  ).toBe(1);
  expect(
    (await admin.fetch('/products', post({ ...values, published: true })))
      .status,
  ).toBe(400);
  expect(
    (await admin.fetch('/products', post({ name: '', priceCents: -1 }))).status,
  ).toBe(400);
  expect((await admin.fetch('/products?pageSize=51')).status).toBe(400);
  const list = await admin.fetch(
    '/products?q=Catalog%20test&page=1&pageSize=5',
  );
  expect(await list.json()).toMatchObject({
    data: [{ id: data.id }],
    meta: { page: 1, pageSize: 5, total: 1 },
  });
  expect((await admin.fetch(`/products/${data.id}`)).status).toBe(200);
  expect((await admin.fetch(`/products/${randomUUID()}`)).status).toBe(404);
  const publishKey = key();
  expect(
    (await admin.fetch(`/products/${data.id}/publish`, post({}, publishKey)))
      .status,
  ).toBe(200);
  const publishReplay = await admin.fetch(
    `/products/${data.id}/publish`,
    post({}, publishKey),
  );
  expect(publishReplay.headers.get('Idempotency-Replayed')).toBe('true');
  const conflict = await admin.fetch(`/products/${data.id}/publish`, post({}));
  expect(conflict.status).toBe(409);
  expect(await conflict.json()).toMatchObject({
    error: { reason: 'PRODUCT_ALREADY_PUBLISHED' },
  });
  expect(
    await connection
      .repository('catalogProducts')
      .findOne({ filter: { id: data.id } }),
  ).toMatchObject({ published: true });
  const catalog = await testApp.fetch(
    new Request('http://localhost/shop/catalog'),
  );
  expect(await catalog.text()).toContain(values.name);
});

test('ordinary users need explicit grants, and record scopes constrain lists, totals, details and exports', async ({
  app,
  testApp,
  request,
  connection,
}) => {
  const credentials = {
    name: 'Catalog reader',
    email: 'reader@example.test',
    password: 'isolated-test-reader-password',
  };
  expect((await request('/auth/sign-up/email', post(credentials))).status).toBe(
    200,
  );
  const user = await signIn(testApp, credentials);
  expect((await user.fetch('/products')).status).toBe(403);
  const authz = app.container.resolve(authorizationToken);
  const filter = buildFilter((f) => f.boolean('published').isTrue());
  await authz.permissionSets.create(
    definePermissionSet('test-catalog-published')
      .title('Published products only')
      .grant(
        catalogResource.reference().grant({
          view: {
            products: selection.recordAccess('customFilter', { filter }),
          },
        }),
      )
      .build(),
  );
  await authz.permissionSets.assign({
    permissionSet: 'test-catalog-published',
    subject: { type: 'user', id: user.user.id },
  });
  const publicId = randomUUID(),
    privateId = randomUUID();
  await connection.repository('catalogProducts').createOne({
    values: {
      id: publicId,
      name: 'Scoped public',
      priceCents: 100,
      published: true,
    },
  });
  await connection.repository('catalogProducts').createOne({
    values: {
      id: privateId,
      name: 'Scoped private',
      priceCents: 200,
      published: false,
    },
  });
  const list = await user.fetch('/products?q=Scoped');
  expect(list.status).toBe(200);
  expect(await list.json()).toMatchObject({
    data: [{ id: publicId }],
    meta: { total: 1 },
  });
  expect((await user.fetch(`/products/${privateId}`)).status).toBe(404);
  expect(
    (
      await user.fetch(
        '/products',
        post({ name: 'Forbidden', priceCents: 100 }),
      )
    ).status,
  ).toBe(403);
  expect(
    (await user.fetch(`/products/${publicId}/publish`, post({}))).status,
  ).toBe(403);
  const anonymous = await testApp.fetch(
    new Request('http://localhost/shop/catalog/export.csv'),
  );
  expect(anonymous.status).toBe(401);
  const csvResponse = await testApp.fetch(
    new Request('http://localhost/shop/catalog/export.csv', {
      headers: { cookie: user.cookie },
    }),
  );
  expect(csvResponse.status).toBe(200);
  expect(csvResponse.headers.get('Content-Disposition')).toBe(
    'attachment; filename="products.csv"',
  );
  const csv = await csvResponse.text();
  expect(csv).toContain('Scoped public');
  expect(csv).not.toContain('Scoped private');
  const role = await authz.permissionSets.get('test-catalog-published');
  await authz.permissionSets.update('test-catalog-published', {
    ...role!,
    grants: [],
  });
  expect((await user.fetch('/products')).status).toBe(403);
  expect(
    (
      await testApp.fetch(
        new Request('http://localhost/shop/catalog/export.csv', {
          headers: { cookie: user.cookie },
        }),
      )
    ).status,
  ).toBe(403);
});

test('OpenAPI documents API inputs and responses while excluding root routes', async ({
  app,
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const response = await admin.fetch('/swagger');
  expect(response.status).toBe(200);
  const doc = await response.json();
  const paths = doc.paths;
  expect(JSON.stringify(paths)).toContain('createProduct');
  expect(JSON.stringify(paths)).toContain('idempotency-key');
  expect(JSON.stringify(paths)).toContain('publicCategories');
  expect(Object.keys(paths).some((path) => path.includes('/catalog'))).toBe(
    false,
  );
  expect(findUndeclaredApiRoutes(app)).toEqual([]);
});
