import { defineMigration } from '@nocobase/db';
export default defineMigration({
  name: '202610300101_create_projects',
  async up({ builder }) {
    await builder.createCollection('projects', (c) => {
      c.string('id', { length: 36, primaryKey: true, nullable: false });
      c.string('name', { length: 120, nullable: false });
      c.datetime('createdAt', { nullable: false });
      c.index('createdAt');
    });
  },
  async down({ builder }) { await builder.dropCollection('projects'); },
});
