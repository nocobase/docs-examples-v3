import { fileURLToPath } from 'node:url';
import { describeMigration } from '@nocobase/app-testing/server';
import metadata from '../../package.json' with { type: 'json' };
describeMigration('202610300101_create_projects', {
  sources: [
    {
      packageName: metadata.name,
      directory: fileURLToPath(
        new URL('../../database/main/migrations/', import.meta.url),
      ),
    },
  ],
  up: async ({ expectCollection }) => {
    await expectCollection('projects').toHaveField('name', {
      type: 'string',
      nullable: false,
    });
    await expectCollection('projects').toHaveIndex(['createdAt']);
  },
  down: async ({ expectCollection }) => {
    await expectCollection('projects').not.toExist();
  },
});
