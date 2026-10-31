import { randomUUID } from 'node:crypto';
import type { DatabaseConnection } from '@nocobase/db';
export async function addSampleRecords(
  connection: DatabaseConnection,
  ownerId: string,
) {
  return connection.transaction(async (tx) => {
    const customers = tx.repository('accessCustomers');
    let firstId = '';
    for (const [name, email, notes] of [
      ['Acme Supplies', 'jordan@example.test', 'Annual supply agreement'],
      ['Harbor Retail', 'alex@example.test', 'Prefers email updates'],
    ]) {
      const existing = await customers.findOne({ filter: { ownerId, name } });
      const id = typeof existing?.id === 'string' ? existing.id : randomUUID();
      firstId ||= id;
      if (!existing)
        await customers.createOne({
          values: {
            id,
            ownerId,
            name,
            email,
            notes,
            internalNote: 'Internal margin: 18%',
          },
        });
    }
    const orders = tx.repository('accessOrders');
    if (!(await orders.findOne({ filter: { ownerId, number: 'SO-1001' } })))
      await orders.createOne({
        values: {
          id: randomUUID(),
          ownerId,
          number: 'SO-1001',
          customerId: firstId,
        },
      });
    return {
      customers: await customers.count({ filter: { ownerId } }),
      orders: await orders.count({ filter: { ownerId } }),
    };
  });
}
