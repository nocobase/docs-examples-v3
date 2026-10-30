import { defineMigration } from '@nocobase/db';

export default defineMigration({
  name: '202610300101_create_devices',
  async up({ builder }) {
    await builder.createCollection('devices', (c) => {
      c.string('id', { length: 36, primaryKey: true, nullable: false });
      c.string('assetTag', { length: 40, nullable: false });
      c.string('name', { length: 120, nullable: false });
      c.string('category', { length: 16, nullable: false });
      c.string('serialNumber', { length: 80, nullable: true });
      c.string('status', { length: 16, nullable: false, defaultValue: 'inStock' });
      c.string('assigneeId', { length: 255, nullable: true });
      c.string('location', { length: 120, nullable: false, defaultValue: '' });
      c.string('purchaseDate', { length: 10, nullable: true });
      c.text('notes', { nullable: false, defaultValue: '' });
      c.datetime('createdAt', { nullable: false });
      c.datetime('updatedAt', { nullable: false });
      c.unique('assetTag');
      c.index(['status', 'category']);
      c.index('assigneeId');
      c.index('updatedAt');
    });
  },
  async down({ builder }) {
    await builder.dropCollection('devices');
  },
});
