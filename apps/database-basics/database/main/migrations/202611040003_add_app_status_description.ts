import { defineMigration } from '@nocobase/db';

export default defineMigration({
  name: '202611040003_add_app_status_description',
  async up({ builder }) {
    await builder.alterCollection('appStatuses', (collection) => {
      collection.text('description').nullable();
    });
  },
  async down({ builder }) {
    await builder.dropField('appStatuses', 'description');
  },
});
