import { defineMigration } from '@nocobase/db';

export default defineMigration({
  name: '202610310001_orders',
  async up({ builder }) {
    await builder.createCollection('customers', (c) => {
      c.string('id', { primaryKey: true, nullable: false });
      c.string('name', { nullable: false });
    });
    await builder.createCollection('orders', (c) => {
      c.string('id', { primaryKey: true, nullable: false });
      c.string('customerId', { nullable: false });
      c.string('reference', { nullable: false });
      c.json('items', { nullable: false });
      c.string('note', { nullable: true });
      c.string('status', { nullable: false, defaultValue: 'draft' });
    });
  },
  async down({ builder }) {
    await builder.dropCollection('orders');
    await builder.dropCollection('customers');
  },
});
