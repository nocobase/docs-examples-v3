import { randomUUID } from 'node:crypto';
import {
  DEFAULT_ADMIN_CREDENTIALS,
  signIn,
} from '@nocobase/app-plugin-authentication/testing';
import { createAppTest } from '@nocobase/app-testing/server';
import { expect, vi } from 'vitest';
import { createStandaloneServer } from '../../server/standalone.js';
const test = createAppTest({
  createServer: createStandaloneServer,
  connections: ['main'],
  config: {
    app: { publicOrigin: 'http://localhost' },
    auth: {
      secret: 'test-auth-secret-at-least-32-characters',
      trustedOrigins: ['http://localhost'],
      emailAndPassword: { disableSignUp: false },
    },
  },
});
const operation = () => `${Date.now()}.${randomUUID()}`;
const post = (data: unknown, key = operation()): RequestInit => ({
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    Origin: 'http://localhost',
    'Idempotency-Key': key,
  },
  body: JSON.stringify(data),
});
test('persists customer mutations, replays lost results, validates fields and rejects unauthorized requests', async ({
  testApp,
  request,
  connection,
}) => {
  expect((await request('/customerList')).status).toBe(401);
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const key = operation();
  const values = {
    id: key.slice(14),
    name: 'Alpha customer',
    contact: 'Avery',
    email: 'avery@example.test',
    status: 'active',
  };
  const created = await admin.fetch(
    '/customers/createOne',
    post({ values }, key),
  );
  expect(created.status).toBe(200);
  const replay = await admin.fetch(
    '/customers/createOne',
    post({ values }, key),
  );
  expect(replay.status).toBe(200);
  expect(replay.headers.get('Idempotency-Replayed')).toBe('true');
  expect(await connection.repository('customers').count()).toBe(1);
  expect(
    (
      await admin.fetch(
        '/customers/updateOne',
        post({
          filter: { id: values.id },
          values: {
            name: '',
            contact: 'Avery',
            email: 'bad',
            status: 'active',
          },
        }),
      )
    ).status,
  ).toBe(400);
  const list = await admin.fetch('/customerList?q=alpha&pageSize=5');
  expect(list.status).toBe(200);
  expect(await list.json()).toMatchObject({
    data: [{ id: values.id }],
    meta: { total: 1 },
  });
  expect((await admin.fetch('/customerList?sort=password')).status).toBe(400);
  const member = {
    name: 'Restricted reader',
    email: 'directory-reader@example.test',
    password: 'test-directory-password',
  };
  expect((await request('/auth/sign-up/email', post(member))).status).toBe(200);
  const denied = await signIn(testApp, member);
  expect((await denied.fetch('/customerList')).status).toBe(403);
  expect((await denied.fetch('/customers/findMany', post({}))).status).toBe(
    403,
  );
  expect(
    (
      await denied.fetch(
        '/customers/createOne',
        post({ values: { ...values, id: randomUUID() } }),
      )
    ).status,
  ).toBe(403);
  vi.stubEnv('CUSTOMER_DEMO_FAULTS', '1');
  try {
    const lostKey = operation();
    const lostValues = {
      ...values,
      id: lostKey.slice(14),
      name: 'Committed response lost',
    };
    expect(
      (
        await admin.fetch(
          '/customerDemo/nextWrite',
          post({ key: lostKey, mode: 'lose' }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await admin.fetch(
          '/customers/createOne',
          post({ values: lostValues }, lostKey),
        )
      ).status,
    ).toBe(503);
    expect(await connection.repository('customers').count()).toBe(2);
    const recovered = await admin.fetch(
      '/customers/createOne',
      post({ values: lostValues }, lostKey),
    );
    expect(recovered.status).toBe(200);
    expect(recovered.headers.get('Idempotency-Replayed')).toBe('true');
    expect(await connection.repository('customers').count()).toBe(2);
  } finally {
    vi.unstubAllEnvs();
  }
});
