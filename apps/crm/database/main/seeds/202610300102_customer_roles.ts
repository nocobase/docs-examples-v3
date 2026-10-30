import metadata from '../../../package.json' with { type: 'json' };
import { defineSeed } from '@nocobase/db';
import { encodeAuthorizationTitle } from '@nocobase/authorization/core';
import { definePermissionSet } from '@nocobase/authorization/permission-sets';

// Keep installation data self-contained: the migration loader runs native ESM.
const customerRoles = [
  {
    key: 'sales-manager',
    title: 'managerRole',
    actions: ['read', 'create', 'edit', 'progress', 'delete'],
    scope: 'allRecords',
  },
  {
    key: 'sales-rep',
    title: 'memberRole',
    actions: ['read', 'progress'],
    scope: 'customers.assigned',
  },
  {
    key: 'customer-reader',
    title: 'readerRole',
    actions: ['read'],
    scope: 'allRecords',
  },
].map(({ key, title, actions, scope }) =>
  definePermissionSet(key)
    .title({ ns: metadata.name, key: `customers.${title}` })
    .grant({
      resource: { type: 'page', id: 'customers' },
      actions: [{ action: 'access' }],
    })
    .grant({
      resource: { type: 'composite', id: 'customers' },
      actions: actions.map((action) => ({
        action,
        policy: { type: 'composite', scopes: { customers: scope } },
      })),
    })
    .build(),
);
export default defineSeed({
  name: '202610300102_customer_roles',
  transaction: true,
  async run({ query }) {
    for (const role of customerRoles) {
      const existing = await query
        .selectFrom('authorizationPermissionSets')
        .select('id')
        .where('key', '=', role.key)
        .executeTakeFirst();
      if (existing) continue;
      const now = new Date();
      await query
        .insertInto('authorizationPermissionSets')
        .values({
          id: role.key,
          key: role.key,
          title: encodeAuthorizationTitle(role.title),
          grants: JSON.stringify(role.grants),
          createdAt: now,
          updatedAt: now,
        })
        .execute();
    }
  },
});
