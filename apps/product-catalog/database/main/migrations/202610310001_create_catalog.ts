import { defineMigration } from '@nocobase/db';
export default defineMigration({
  name: '202610310001_create_catalog',
  async up({ builder }) {
    await builder.createCollection('catalogCategories', (c) => {
      c.string('id', { length: 40 }).primary().notNull();
      c.string('title', { length: 100 }).notNull();
      c.string('internalNote', { length: 200 }).notNull();
    });
    await builder.createCollection('catalogProducts', (c) => {
      c.string('id', { length: 36 }).primary().notNull();
      c.string('name', { length: 100 }).notNull();
      c.integer('priceCents').notNull();
      c.boolean('published').notNull().defaultTo(false);
      c.index(['published', 'name']);
    });
  },
  async down({ builder }) {
    await builder.dropCollection('catalogProducts');
    await builder.dropCollection('catalogCategories');
  },
});
