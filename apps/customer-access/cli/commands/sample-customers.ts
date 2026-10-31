import { AppCommand, CommandError } from '@nocobase/app-cli';
import { Flags } from '@oclif/core';
export default class SampleCustomers extends AppCommand {
  static override summary =
    'Add fictional customers and an order for an existing user; assign no roles.';
  static override flags = {
    email: Flags.string({
      required: true,
      description: 'Exact email of the existing owner.',
    }),
    'dry-run': Flags.boolean({
      description: 'Show the owner without writing sample records.',
    }),
  };
  async run() {
    const { flags } = await this.parse(SampleCustomers);
    const { databaseManagerToken } = await import('@nocobase/db');
    const { addSampleRecords } = await import('../../server/access/sample.js');
    return this.withApp(async ({ app }) => {
      await app.start();
      const connection = app.container
        .resolve(databaseManagerToken)
        .connection();
      const user = await connection
        .repository('user')
        .findOne({ filter: { email: flags.email.toLowerCase() } });
      if (!user)
        throw new CommandError('Create the user in User management first.', {
          code: 'USER_NOT_FOUND',
        });
      if (flags['dry-run']) {
        this.setStatus('success-noop');
        return {
          ownerId: String(user.id),
          planned: 'Two customers and one order, unless already present.',
        };
      }
      const result = await addSampleRecords(connection, String(user.id));
      this.log(
        `Sample data ready: ${result.customers} customers and ${result.orders} orders.`,
      );
      return result;
    });
  }
}
