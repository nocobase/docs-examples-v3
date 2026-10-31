import { defineSeed } from '@nocobase/db';

export default defineSeed({
  name: '202611040002_default_app_statuses',
  async run(context) {
    const statuses = context.repository('appStatuses');
    for (const values of [
      { code: 'draft', title: 'Draft' },
      { code: 'published', title: 'Published' },
    ]) {
      if (await statuses.findOne({ filter: { code: values.code } })) continue;
      await statuses.createOne({ values });
    }
  },
});
