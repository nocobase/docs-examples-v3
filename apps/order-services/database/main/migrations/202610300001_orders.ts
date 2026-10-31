import { defineMigration } from '@nocobase/db';
export default defineMigration({
  name: '202610300001_orders',
  async up({ builder }) {
    await builder.createCollection('products', (c) => {
      c.string('id', { primaryKey: true, nullable: false });
      c.string('name', { nullable: false });
      c.integer('stock', { nullable: false });
    });
    await builder.createCollection('orders', (c) => {
      c.string('id', { primaryKey: true, nullable: false });
      c.string('ownerId', { nullable: false });
      c.string('productId', { nullable: false });
      c.integer('quantity', { nullable: false });
      c.string('status', { nullable: false, defaultValue: 'draft' });
    });
  },
  async down({ builder }) {
    await builder.dropCollection('orders');
    await builder.dropCollection('products');
  },
});
