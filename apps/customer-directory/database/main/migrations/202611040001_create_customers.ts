import { defineMigration } from '@nocobase/db';
export default defineMigration({
  name: '202611040001_create_customers',
  async up({ builder }) {
    await builder.createCollection('customers', (c) => {
      c.string('id', { length: 64 }).primary().notNull();
      c.string('name', { length: 100 }).notNull();
      c.string('contact', { length: 100 }).notNull();
      c.string('email', { length: 200 }).notNull();
      c.string('status', { length: 20 }).notNull();
      c.index('name');
    });
  },
  async down({ builder }) { await builder.dropCollection('customers'); },
});
