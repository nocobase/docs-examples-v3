import path from 'node:path';
import { describeMigration } from '@nocobase/app-testing/server';
import { expect } from 'vitest';
describeMigration('202610310001_customer_access', {
  sources: [
    {
      packageName: 'customer-access',
      directory: path.resolve(
        import.meta.dirname,
        '../../database/main/migrations',
      ),
    },
  ],
  up: async ({ connection, expectCollection }) => {
    await expectCollection('accessCustomers').toHaveField('ownerId', {
      nullable: false,
    });
    await expectCollection('accessOrders').toExist();
    await connection.repository('accessCustomers').createOne({
      values: {
        id: 'test',
        name: 'Test',
        email: 'test@example.test',
        ownerId: 'owner',
      },
    });
    expect(await connection.repository('accessCustomers').count()).toBe(1);
  },
  down: async ({ expectCollection }) => {
    await expectCollection('accessOrders').not.toExist();
    await expectCollection('accessCustomers').not.toExist();
  },
});
