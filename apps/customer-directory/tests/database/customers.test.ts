import path from 'node:path';
import { describeMigration } from '@nocobase/app-testing/server';
import { expect } from 'vitest';
describeMigration('202611040001_create_customers', {
  sources: [
    {
      packageName: 'customer-directory',
      directory: path.resolve(
        import.meta.dirname,
        '../../database/main/migrations',
      ),
    },
  ],
  up: async ({ connection, expectCollection }) => {
    const collection = await expectCollection('customers').toExist();
    expect(collection.primaryKey).toEqual(['id']);
    for (const field of ['name', 'contact', 'email', 'status'])
      await expectCollection('customers').toHaveField(field, {
        nullable: false,
      });
    await connection.repository('customers').createOne({
      values: {
        id: 'check',
        name: 'Customer',
        contact: 'Avery',
        email: 'avery@example.test',
        status: 'active',
      },
    });
    expect(await connection.repository('customers').count()).toBe(1);
  },
  down: async ({ expectCollection }) => {
    await expectCollection('customers').not.toExist();
  },
});
