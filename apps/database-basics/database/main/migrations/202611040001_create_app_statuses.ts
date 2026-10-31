import { defineMigration } from '@nocobase/db';

export default defineMigration({
  name: '202611040001_create_app_statuses',
  async up({ builder }) {
    await builder.createCollection('appStatuses', (collection) => {
      collection.string('code', { length: 32 }).primary().notNull();
      collection.string('title', { length: 100 }).notNull();
    });
  },
  async down({ builder }) {
    await builder.dropCollection('appStatuses');
  },
});
