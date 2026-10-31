import type { Application } from '@nocobase/app-server/application';
import { databaseManagerToken } from '@nocobase/db';
import { userAdministrationServiceToken } from '@nocobase/app-plugin-authentication/server';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { definePermissionSet } from '@nocobase/authorization/permission-sets';

export const ids = {
  customer: '11111111-1111-4111-8111-111111111111',
  draft: '22222222-2222-4222-8222-222222222222',
  confirmed: '33333333-3333-4333-8333-333333333333',
  missing: '99999999-9999-4999-8999-999999999999',
};
export async function createFixtures(app: Application, password: string) {
  const users = app.container.resolve(userAdministrationServiceToken);
  const authz = app.container.resolve(authorizationToken);
  const editor = await users.create({
    name: 'Alice Sales',
    email: 'alice@example.test',
    password,
  });
  const reader = await users.create({
    name: 'Robin Reader',
    email: 'robin@example.test',
    password,
  });
  for (const [person, actions] of [
    [editor, ['read', 'create', 'update']],
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
              scopes: { orders: 'allRecords', customers: 'allRecords' },
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
  await database
    .repository('customers')
    .createOne({ values: { id: ids.customer, name: 'Alpine Goods' } });
  for (const status of ['draft', 'confirmed'] as const) {
    await database.repository('orders').createOne({
      values: {
        id: ids[status],
        customerId: ids.customer,
        reference: status === 'draft' ? 'SO-1001' : 'SO-1002',
        items: [{ name: 'Office keyboard', quantity: 2 }],
        note: 'Deliver in the morning.',
        status,
      },
    });
  }
  return {
    editor: { id: editor.id, email: editor.email },
    reader: { id: reader.id, email: reader.email },
    password,
    ids,
  };
}
