import { defineSeed } from '@nocobase/db';
import { definePermissionSet } from '@nocobase/authorization/permission-sets';
import { encodeAuthorizationTitle } from '@nocobase/authorization/core';
import { catalogResource } from '../../../server/catalog-resource.ts';
export default defineSeed({
  name: '202610310001_catalog_roles',
  async run({ query }) {
    const viewer = definePermissionSet('catalog-viewer')
      .title({ key: 'catalog.viewer', ns: 'product-catalog' })
      .grant(
        catalogResource.reference().grant({ view: { products: 'allRecords' } }),
      )
      .build();
    const editor = definePermissionSet('catalog-editor')
      .title({ key: 'catalog.editor', ns: 'product-catalog' })
      .grant(
        catalogResource
          .reference()
          .grant({
            view: { products: 'allRecords' },
            create: { products: 'allRecords' },
            publish: { products: 'allRecords' },
          }),
      )
      .build();
    for (const role of [viewer, editor]) {
      if (
        await query
          .selectFrom('authorizationPermissionSets')
          .select('id')
          .where('key', '=', role.key)
          .executeTakeFirst()
      )
        continue;
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
