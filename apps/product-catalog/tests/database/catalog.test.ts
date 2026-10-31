import path from 'node:path';
import { describeMigration } from '@nocobase/app-testing/server';
import { expect } from 'vitest';
describeMigration('202610310001_create_catalog', {
  sources: [
    {
      packageName: 'product-catalog',
      directory: path.resolve(
        import.meta.dirname,
        '../../database/main/migrations',
      ),
    },
  ],
  up: async ({ connection, expectCollection }) => {
    await expectCollection('catalogProducts').toHaveField('published', {
      nullable: false,
    });
    await expectCollection('catalogCategories').toExist();
    await connection
      .repository('catalogProducts')
      .createOne({
        values: {
          id: 'test-product',
          name: 'Lamp',
          priceCents: 100,
          published: false,
        },
      });
    expect(await connection.repository('catalogProducts').count()).toBe(1);
  },
  down: async ({ expectCollection }) => {
    await expectCollection('catalogProducts').not.toExist();
    await expectCollection('catalogCategories').not.toExist();
  },
});
