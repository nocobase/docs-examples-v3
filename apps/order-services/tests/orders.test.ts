import { expect, vi } from 'vitest';
import { createAppTest } from '@nocobase/app-testing/server';
import { signIn } from '@nocobase/app-plugin-authentication/testing';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { userAdministrationServiceToken } from '@nocobase/app-plugin-authentication/server';
import { databaseManagerToken } from '@nocobase/db';
import { createStandaloneServer } from '../server/standalone.js';
import { createFixtures } from '../scripts/fixtures.js';
import { orderServiceToken } from '../server/providers/orders.js';
import { DefaultOrderService } from '../server/orders/service.js';
import { authorizeOrder } from '../server/orders/permissions.js';
import { actorContext } from '../server/orders/actor.js';
import { createConfirmOrderJob } from '../server/orders/job.js';
import { confirmFromCommand } from '../cli/confirm.js';

const test = createAppTest({
  createServer: createStandaloneServer,
  connections: ['main'],
  config: {
    logging: { enabled: false },
    app: { publicOrigin: 'http://localhost' },
    auth: { secret: 'orders-test-auth-secret-at-least-32-characters' },
  },
});
const post = { method: 'POST', headers: { origin: 'http://localhost' } };

test('confirms once, persists stock and rolls back an insufficient-stock order', async ({
  testApp,
}) => {
  const app = testApp.application;
  const fixture = await createFixtures(app, 'test-password-123456');
  const buyer = await signIn(testApp, {
    email: fixture.buyer.email,
    password: fixture.password,
  });
  expect((await testApp.request(`/orders/${fixture.orders.http}`)).status).toBe(
    401,
  );
  for (let i = 0; i < 2; i++) {
    const response = await buyer.fetch(
      `/orders/${fixture.orders.http}/confirm`,
      post,
    );
    expect(await response.json()).toMatchObject({
      data: { status: 'confirmed' },
    });
    expect(response.status).toBe(200);
  }
  const database = app.container.resolve(databaseManagerToken);
  expect(
    await database
      .repository('products')
      .findOne({ filter: { id: fixture.productId } }),
  ).toMatchObject({ stock: 8 });
  const shortage = await buyer.fetch(
    `/orders/${fixture.orders.shortage}/confirm`,
    post,
  );
  expect(shortage.status).toBe(409);
  expect(await shortage.json()).toMatchObject({
    error: { reason: 'OUT_OF_STOCK' },
  });
  expect(
    await database
      .repository('orders')
      .findOne({ filter: { id: fixture.orders.shortage } }),
  ).toMatchObject({ status: 'draft' });
  expect(
    await database
      .repository('products')
      .findOne({ filter: { id: fixture.productId } }),
  ).toMatchObject({ stock: 8 });
});

test('isolates users and denies a reader even on an owned order', async ({
  testApp,
}) => {
  const fixture = await createFixtures(
    testApp.application,
    'test-password-123456',
  );
  const buyer = await signIn(testApp, {
    email: fixture.buyer.email,
    password: fixture.password,
  });
  const other = await signIn(testApp, {
    email: fixture.other.email,
    password: fixture.password,
  });
  const reader = await signIn(testApp, {
    email: fixture.reader.email,
    password: fixture.password,
  });
  expect(
    (await buyer.fetch(`/orders/${fixture.orders.other}/confirm`, post)).status,
  ).toBe(404);
  expect((await other.fetch(`/orders/${fixture.orders.other}`)).status).toBe(
    200,
  );
  expect((await reader.fetch(`/orders/${fixture.orders.reader}`)).status).toBe(
    200,
  );
  expect(
    (await reader.fetch(`/orders/${fixture.orders.reader}/confirm`, post))
      .status,
  ).toBe(403);
  expect((await buyer.fetch(`/orders/${fixture.orders.http}`)).status).toBe(
    200,
  );
});

test('reuses the service from a local command and an actual background executor', async ({
  testApp,
}) => {
  const fixture = await createFixtures(
    testApp.application,
    'test-password-123456',
  );
  const result = await confirmFromCommand(
    testApp.application,
    fixture.buyer.id,
    fixture.orders.cli,
  );
  expect(result.status).toBe('confirmed');
  const buyer = await signIn(testApp, {
    email: fixture.buyer.email,
    password: fixture.password,
  });
  const response = await buyer.fetch(
    `/orders/${fixture.orders.job}/confirmAsync`,
    post,
  );
  expect(response.status).toBe(202);
  expect(await response.json()).toMatchObject({
    data: { jobId: expect.any(String) },
  });
  const database = testApp.application.container.resolve(databaseManagerToken);
  await expect
    .poll(
      async () =>
        (
          await database
            .repository('orders')
            .findOne({ filter: { id: fixture.orders.job } })
        )?.status,
    )
    .toBe('confirmed');
  expect(
    await database
      .repository('products')
      .findOne({ filter: { id: fixture.productId } }),
  ).toMatchObject({ stock: 6 });
});

test('rechecks a revoked role and a disabled actor at job execution', async ({
  testApp,
}) => {
  const app = testApp.application;
  const fixture = await createFixtures(app, 'test-password-123456');
  const JobClass = createConfirmOrderJob(
    app,
    app.container.resolve(orderServiceToken),
  );
  const job = new JobClass({
    actorId: fixture.buyer.id,
    orderId: fixture.orders.job,
  });
  await app.container
    .resolve(authorizationToken)
    .permissionSets.revoke(`orders-${fixture.buyer.id}`);
  await expect(job.execute()).rejects.toThrow('Order action is not permitted.');
  await app.container
    .resolve(userAdministrationServiceToken)
    .disable(fixture.other.id);
  await expect(
    new JobClass({
      actorId: fixture.other.id,
      orderId: fixture.orders.other,
    }).execute(),
  ).rejects.toThrow('The actor is unavailable.');
  const database = app.container.resolve(databaseManagerToken);
  expect(
    await database
      .repository('products')
      .findOne({ filter: { id: fixture.productId } }),
  ).toMatchObject({ stock: 10 });
});

test('does not undo a commit or repeat the callback when a post-commit effect fails', async ({
  testApp,
}) => {
  const app = testApp.application;
  const fixture = await createFixtures(app, 'test-password-123456');
  const policies = await authorizeOrder(
    await actorContext(app, fixture.buyer.id),
    'confirm',
  );
  const effect = vi.fn(() => {
    throw new Error('Simulated log failure');
  });
  const warning = vi
    .spyOn(process, 'emitWarning')
    .mockImplementation(() => undefined);
  try {
    const service = new DefaultOrderService(
      app.container.resolve(databaseManagerToken),
      effect,
    );
    await expect(
      service.confirm(policies, fixture.orders.http),
    ).resolves.toMatchObject({ status: 'confirmed' });
    await expect(
      service.confirm(policies, fixture.orders.http),
    ).resolves.toMatchObject({ status: 'confirmed' });
    expect(effect).toHaveBeenCalledOnce();
    expect(warning).toHaveBeenCalled();
  } finally {
    warning.mockRestore();
  }
});

test('keeps order status and stock unchanged when product scope excludes the product', async ({
  testApp,
}) => {
  const app = testApp.application;
  const fixture = await createFixtures(app, 'test-password-123456');
  const policies = await authorizeOrder(
    await actorContext(app, fixture.buyer.id),
    'confirm',
  );
  const effect = vi.fn();
  const database = app.container.resolve(databaseManagerToken);
  const service = new DefaultOrderService(database, effect);
  await expect(
    service.confirm(
      {
        ...policies,
        products: {
          read: { scope: { id: 'excluded-product' }, fields: ['id', 'stock'] },
          create: false,
          update: false,
          delete: false,
        },
      },
      fixture.orders.http,
    ),
  ).rejects.toThrow('OUT_OF_STOCK');
  expect(
    await database
      .repository('orders')
      .findOne({ filter: { id: fixture.orders.http } }),
  ).toMatchObject({ status: 'draft' });
  expect(
    await database
      .repository('products')
      .findOne({ filter: { id: fixture.productId } }),
  ).toMatchObject({ stock: 10 });
  expect(effect).not.toHaveBeenCalled();
});

test('does not deduct twice when confirmations overlap', async ({
  testApp,
}) => {
  const app = testApp.application;
  const fixture = await createFixtures(app, 'test-password-123456');
  const policies = await authorizeOrder(
    await actorContext(app, fixture.buyer.id),
    'confirm',
  );
  const service = app.container.resolve(orderServiceToken);
  const outcomes = await Promise.allSettled([
    service.confirm(policies, fixture.orders.http),
    service.confirm(policies, fixture.orders.http),
  ]);
  expect(outcomes.some((result) => result.status === 'fulfilled')).toBe(true);
  expect(
    await app.container
      .resolve(databaseManagerToken)
      .repository('products')
      .findOne({ filter: { id: fixture.productId } }),
  ).toMatchObject({ stock: 8 });
});
