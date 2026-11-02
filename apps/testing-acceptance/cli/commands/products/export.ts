import { writeFile } from 'node:fs/promises';
import { AppCommand, CommandError, appPath } from '@nocobase/app-cli';
import { Flags } from '@oclif/core';
import { catalogServiceToken } from '../../../server/providers/catalog.js';
import { publicProductPolicy } from '../../../server/providers/catalog-service.js';

export default class ExportProducts extends AppCommand {
  static override summary =
    'Export up to 500 published products to a new JSON file.';
  static override flags = {
    output: appPath({
      required: true,
      description: 'New JSON file; parent directory must exist.',
    }),
    'dry-run': Flags.boolean({ default: false }),
  };
  async run() {
    const { flags } = await this.parse(ExportProducts);
    const products = await this.withApp(async ({ app }) => {
      await app.start();
      const result = await app.container
        .resolve(catalogServiceToken)
        .list(publicProductPolicy, { q: '', page: 1, pageSize: 500 });
      if (result.meta.total > 500)
        throw new CommandError('Export exceeds 500 products.', {
          code: 'EXPORT_LIMIT',
        });
      return result.data;
    });
    if (!flags['dry-run']) {
      try {
        await writeFile(
          flags.output,
          JSON.stringify(products, null, 2) + '\n',
          { flag: 'wx' },
        );
      } catch (error) {
        throw new CommandError('Could not create the export file.', {
          code: 'EXPORT_WRITE_FAILED',
          cause: error,
        });
      }
    }
    return {
      file: flags.output,
      count: products.length,
      written: !flags['dry-run'],
    };
  }
}
