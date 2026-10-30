import metadata from '../../../package.json' with { type: 'json' };
import { defineSeed } from '@nocobase/db';
import { encodeAuthorizationTitle } from '@nocobase/authorization/core';
import { definePermissionSet } from '@nocobase/authorization/permission-sets';

// Keep installation data self-contained: the seed loader runs native ESM and must not import evolving declarations.
// The three jobs of docs/design.md §2. Every action reaches all records in this first version; the data ranges of
// §6 (employees see only their own) are applied by a later step. Administrators may change all of it under
// Permission management afterwards; this seed runs once and never overwrites their changes.
type Grant = { resource: string; actions: [action: string, scopes: Record<string, string>][] };

/** Each action reaching all records of the collections it touches. */
const actions = (names: string[], ...collections: string[]): Grant['actions'] =>
  names.map((name) => [name, Object.fromEntries(collections.map((collection) => [collection, 'allRecords']))]);

const roles: { key: string; title: string; grants: Grant[] }[] = [
  {
    key: 'employee',
    title: 'employee',
    grants: [
      { resource: 'devices', actions: actions(['read'], 'devices') },
      { resource: 'deviceRequests', actions: actions(['read', 'create', 'withdraw'], 'deviceRequests') },
    ],
  },
  {
    key: 'it-support',
    title: 'itSupport',
    grants: [
      { resource: 'devices', actions: actions(['read', 'create', 'edit'], 'devices') },
      {
        resource: 'deviceRequests',
        actions: [
          ...actions(['read', 'create', 'withdraw'], 'deviceRequests'),
          ...actions(['issue'], 'deviceRequests', 'devices'),
        ],
      },
    ],
  },
  {
    key: 'asset-manager',
    title: 'assetManager',
    grants: [
      { resource: 'devices', actions: actions(['read', 'create', 'edit', 'delete'], 'devices') },
      { resource: 'deviceRequests', actions: actions(['read', 'create', 'withdraw', 'approve'], 'deviceRequests') },
    ],
  },
];

const permissionSets = roles.map(({ key, title, grants }) => {
  let builder = definePermissionSet(key)
    .title({ ns: metadata.name, key: `roles.${title}` })
    .grant({ resource: { type: 'page', id: 'devices' }, actions: [{ action: 'access' }] })
    .grant({ resource: { type: 'page', id: 'requests' }, actions: [{ action: 'access' }] });
  for (const grant of grants)
    builder = builder.grant({
      resource: { type: 'composite', id: grant.resource },
      actions: grant.actions.map(([action, scopes]) => ({ action, policy: { type: 'composite', scopes } })),
    });
  return builder.build();
});

export default defineSeed({
  name: '202610300202_itam_roles',
  transaction: true,
  async run({ query }) {
    for (const role of permissionSets) {
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
