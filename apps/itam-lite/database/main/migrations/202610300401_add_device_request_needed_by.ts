import { defineMigration } from '@nocobase/db';

/** The date a requester would like the device by (docs/design.md §3), stored as `YYYY-MM-DD`. Existing requests keep it empty. */
export default defineMigration({
  name: '202610300401_add_device_request_needed_by',
  async up({ builder }) {
    await builder.alterCollection('deviceRequests', (c) => {
      c.string('neededBy', { length: 10, nullable: true });
    });
  },
  async down({ builder }) {
    await builder.dropField('deviceRequests', 'neededBy');
  },
});
