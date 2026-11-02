import path from 'node:path';
import { createDatabaseTest } from '@nocobase/app-testing/server';
import { expect } from 'vitest';
import metadata from '../../package.json' with { type: 'json' };
const test = createDatabaseTest({
  migrations: [
    {
      packageName: metadata.name,
      directory: path.resolve(
        import.meta.dirname,
        '../../database/main/migrations',
      ),
    },
  ],
});
test('rolls back every product write when the transaction fails', async ({
  connection,
}) => {
  await expect(
    connection.transaction(async (transaction) => {
      await transaction
        .repository('catalogProducts')
        .createOne({
          values: {
            id: 'rollback',
            name: 'Uncommitted',
            priceCents: 100,
            published: false,
          },
        });
      throw new Error('Simulated downstream failure');
    }),
  ).rejects.toThrow('Simulated downstream failure');
  expect(await connection.repository('catalogProducts').count()).toBe(0);
});
test('rejects a duplicate primary key without changing the original', async ({
  connection,
}) => {
  const products = connection.repository('catalogProducts');
  await products.createOne({
    values: { id: 'same', name: 'Original', priceCents: 100, published: false },
  });
  await expect(
    products.createOne({
      values: {
        id: 'same',
        name: 'Duplicate',
        priceCents: 200,
        published: true,
      },
    }),
  ).rejects.toThrow();
  expect(await products.findOne({ filter: { id: 'same' } })).toMatchObject({
    name: 'Original',
    priceCents: 100,
  });
});
