import { defineMigration } from '@nocobase/db';
export default defineMigration({
 name: '202610310001_customer_access',
 async up({ builder }) {
  await builder.createCollection('accessCustomers', (c) => {
   c.string('id', { length: 36 }).primary().notNull();
   c.string('name', { length: 100 }).notNull();
   c.string('email', { length: 200 }).notNull();
   c.text('notes').notNull().defaultTo('');
   c.text('internalNote').notNull().defaultTo('');
   c.string('ownerId', { length: 64 }).notNull();
   c.index(['ownerId', 'name']);
  });
  await builder.createCollection('accessOrders', (c) => {
   c.string('id', { length: 36 }).primary().notNull();
   c.string('number', { length: 40 }).notNull();
   c.string('customerId', { length: 36 }).notNull();
   c.string('ownerId', { length: 64 }).notNull();
   c.index(['ownerId']);
  });
 },
 async down({ builder }) {
  await builder.dropCollection('accessOrders');
  await builder.dropCollection('accessCustomers');
 },
});
