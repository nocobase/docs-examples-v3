import { defineMigration } from '@nocobase/db';

export default defineMigration({
  name: '202610300101_create_customers',
  async up({ builder }) {
    await builder.createCollection('customers', (c) => {
      c.string('id', { length: 36, primaryKey: true, nullable: false });
      c.string('title', { length: 120, nullable: false });
      c.string('contact', { length: 255, nullable: false, defaultValue: '' });
      c.text('description', { nullable: false, defaultValue: '' });
      c.string('status', { length: 16, nullable: false, defaultValue: 'lead' });
      c.string('salesOwnerId', { length: 255, nullable: true });
      c.string('nextFollowUpDate', { length: 10, nullable: true });
      c.datetime('createdAt', { nullable: false });
      c.datetime('updatedAt', { nullable: false });
      c.index(['salesOwnerId', 'status']);
      c.index('nextFollowUpDate');
      c.index('updatedAt');
    });
  },
  async down({ builder }) {
    await builder.dropCollection('customers');
  },
});
