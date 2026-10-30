import metadata from '../../../package.json' with { type: 'json' };
import { defineSeed } from '@nocobase/db';
import { encodeAuthorizationTitle } from '@nocobase/authorization/core';
import { definePermissionSet } from '@nocobase/authorization/permission-sets';

// Keep installation data self-contained: the migration loader runs native ESM.
const projectRoles = [
  { key: 'project-reader', title: 'readerRole', actions: ['read'], scope: 'allRecords' },
  { key: 'project-creator', title: 'creatorRole', actions: ['read', 'create'], scope: 'allRecords' },
].map(({ key, title, actions, scope }) =>
  definePermissionSet(key)
    .title({ ns: metadata.name, key: `projects.${title}` })
    .grant({
      resource: { type: 'page', id: 'projects' },
      actions: [{ action: 'access' }],
    })
    .grant({
      resource: { type: 'composite', id: 'projects' },
      actions: actions.map((action) => ({
        action,
        policy: { type: 'composite', scopes: { projects: scope } },
      })),
    })
    .build(),
);
export default defineSeed({
  name: '202610300102_project_roles',
  transaction: true,
  async run({ query }) {
    for (const role of projectRoles) {
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
