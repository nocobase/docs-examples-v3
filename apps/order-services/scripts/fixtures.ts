import { randomUUID } from 'node:crypto';
import type { Application } from '@nocobase/app-server/application';
import { databaseManagerToken } from '@nocobase/db';
import { userAdministrationServiceToken } from '@nocobase/app-plugin-authentication/server';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { definePermissionSet } from '@nocobase/authorization/permission-sets';

export async function createFixtures(app: Application, password: string) {
  const prefix = randomUUID().slice(0, 8);
  const users = app.container.resolve(userAdministrationServiceToken);
  const authz = app.container.resolve(authorizationToken);
  const buyer = await users.create({
    name: 'Alice Buyer',
    email: `alice-${prefix}@example.test`,
    password,
  });
  const other = await users.create({
    name: 'Bob Buyer',
    email: `bob-${prefix}@example.test`,
    password,
  });
  const reader = await users.create({
    name: 'Robin Reader',
    email: `reader-${prefix}@example.test`,
    password,
  });
  for (const [person, actions] of [
    [buyer, ['read', 'confirm']],
    [other, ['read', 'confirm']],
    [reader, ['read']],
  ] as const) {
    const key = `orders-${person.id}`;
    await authz.permissionSets.create(
      definePermissionSet(key)
        .title(`${person.name} orders`)
        .grant({
          resource: { type: 'composite', id: 'orders' },
          actions: actions.map((action) => ({
            action,
            policy: {
              type: 'composite' as const,
              scopes: {
                orders: 'orders.owned',
                ...(action === 'confirm' ? { products: 'allRecords' } : {}),
              },
            },
          })),
        })
        .build(),
    );
    await authz.permissionSets.assign({
      id: key,
      permissionSet: key,
      subject: { type: 'user', id: person.id },
    });
  }
  const database = app.container.resolve(databaseManagerToken);
  const productId = `${prefix}-keyboard`;
  await database.repository('products').createOne({
    values: { id: productId, name: 'Office keyboard', stock: 10 },
  });
  const orders = {
    http: `${prefix}-http`,
    cli: `${prefix}-cli`,
    job: `${prefix}-job`,
    shortage: `${prefix}-shortage`,
    other: `${prefix}-other`,
    reader: `${prefix}-reader`,
  };
  for (const [kind, id] of Object.entries(orders)) {
    await database.repository('orders').createOne({
      values: {
        id,
        ownerId:
          kind === 'other'
            ? other.id
            : kind === 'reader'
              ? reader.id
              : buyer.id,
        productId,
        quantity: kind === 'shortage' ? 99 : 2,
        status: 'draft',
      },
    });
  }
  return {
    buyer: { id: buyer.id, email: buyer.email },
    other: { id: other.id, email: other.email },
    reader: { id: reader.id, email: reader.email },
    password,
    productId,
    orders,
  };
}
