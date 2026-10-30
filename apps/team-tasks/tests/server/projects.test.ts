import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { createAppTest } from '@nocobase/app-testing/server';
import {
  signIn,
  DEFAULT_ADMIN_CREDENTIALS,
} from '@nocobase/app-plugin-authentication/testing';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { createStandaloneServer } from '../../server/standalone.js';
const test = createAppTest({
  createServer: createStandaloneServer,
  connections: ['main'],
  config: {
    logging: { enabled: false },
    app: { publicOrigin: 'http://localhost' },
    auth: { secret: 'test-auth-secret-at-least-32-characters' },
  },
});
const post = (data: unknown, key = `${Date.now()}.${randomUUID()}`) => ({
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    origin: 'http://localhost',
    'Idempotency-Key': key,
  },
  body: JSON.stringify(data),
});
test('creates, filters and paginates projects; validates input and replays safely', async ({
  testApp,
}) => {
  expect((await testApp.request('/projects')).status).toBe(401);
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  expect((await admin.fetch('/projects', post({ name: '   ' }))).status).toBe(
    400,
  );
  expect(
    (await admin.fetch('/projects', post({ name: 'x'.repeat(121) }))).status,
  ).toBe(400);
  const key = `${Date.now()}.${randomUUID()}`;
  const created = await admin.fetch(
    '/projects',
    post({ name: '  Website launch  ' }, key),
  );
  expect(created.status).toBe(201);
  const body = await created.json();
  expect(body).toMatchObject({ data: { name: 'Website launch' } });
  const replay = await admin.fetch(
    '/projects',
    post({ name: '  Website launch  ' }, key),
  );
  expect(replay.status).toBe(201);
  expect(await replay.json()).toEqual(body);
  expect(replay.headers.get('Idempotency-Replayed')).toBe('true');
  expect(
    (await admin.fetch('/projects', post({ name: 'Other name' }, key))).status,
  ).toBe(409);
  await admin.fetch('/projects', post({ name: 'Customer onboarding' }));
  expect(await (await admin.fetch('/projects?q=Website')).json()).toMatchObject(
    { data: [{ name: 'Website launch' }], meta: { total: 1 } },
  );
  expect(
    await (await admin.fetch('/projects?page=2&pageSize=1')).json(),
  ).toMatchObject({
    data: [{ name: 'Website launch' }],
    meta: { total: 2, page: 2, pageSize: 1 },
  });
  expect(await (await admin.fetch('/projects?q=missing')).json()).toMatchObject(
    { data: [], meta: { total: 0 } },
  );
  const spec = await (await admin.fetch('/swagger')).text();
  expect(spec).toContain('listProjects');
  expect(spec).toContain('createProject');
});
test('checks ordinary readers and creators independently of page permissions', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const credentials = {
    email: 'project-reader@example.test',
    password: 'test-project-password',
  };
  expect(
    (
      await admin.fetch(
        '/users',
        post({ ...credentials, name: 'Project reader' }),
      )
    ).status,
  ).toBe(201);
  const user = await signIn(testApp, credentials);
  expect((await user.fetch('/projects')).status).toBe(403);
  expect(
    (await user.fetch('/projects', post({ name: 'Forbidden' }))).status,
  ).toBe(403);
  const authz = testApp.application.container.resolve(authorizationToken);
  await authz.permissionSets.assign({
    id: 'project-reader-role',
    permissionSet: 'project-reader',
    subject: { type: 'user', id: user.user.id },
  });
  expect((await user.fetch('/projects')).status).toBe(200);
  expect(
    (await user.fetch('/projects', post({ name: 'Forbidden' }))).status,
  ).toBe(403);
  await authz.permissionSets.assign({
    id: 'project-creator-role',
    permissionSet: 'project-creator',
    subject: { type: 'user', id: user.user.id },
  });
  expect(
    (await user.fetch('/projects', post({ name: 'Allowed' }))).status,
  ).toBe(201);
});
