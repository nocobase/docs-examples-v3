import { fileURLToPath } from 'node:url';
import { describeMigration } from '@nocobase/app-testing/server';
import metadata from '../../package.json' with { type: 'json' };
describeMigration('202610300101_create_customers', {
  sources: [
    {
      packageName: metadata.name,
      directory: fileURLToPath(
        new URL('../../database/main/migrations/', import.meta.url),
      ),
    },
  ],
  up: async ({ expectCollection }) => {
    await expectCollection('customers').toHaveField('title', {
      type: 'string',
      nullable: false,
    });
    await expectCollection('customers').toHaveField('salesOwnerId', {
      type: 'string',
      nullable: true,
    });
    await expectCollection('customers').toHaveIndex(['salesOwnerId', 'status']);
    await expectCollection('customers').toHaveIndex(['updatedAt']);
  },
  down: async ({ expectCollection }) => {
    await expectCollection('customers').not.toExist();
  },
});
