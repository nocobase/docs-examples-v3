import { defineSeed } from '@nocobase/db';
import defaults from '../../../../database/main/seeds/202611040002_default_app_statuses.ts';

export default defineSeed({
  name: defaults.name,
  async run(context) {
    await defaults.run(context);
    if (context.config.get('fail')) throw new Error('Intentional seed failure');
  },
});
