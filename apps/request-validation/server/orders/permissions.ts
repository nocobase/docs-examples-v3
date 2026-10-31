import { defineCompositeResource } from '@nocobase/authorization/core';
import { defineDatabasePermission } from '@nocobase/app-plugin-authorization/server';

const orders = defineDatabasePermission((p) =>
  p
    .collection('orders')
    .read(['id', 'customerId', 'reference', 'items', 'note', 'status']),
);
const customers = defineDatabasePermission((p) =>
  p.collection('customers').read(['id', 'name']),
);
export const orderPermissions = defineCompositeResource('orders', (r) =>
  r
    .title('Orders')
    .action('read', (a) =>
      a
        .title('Read orders')
        .grant('orders', orders)
        .grant('customers', customers),
    )
    .action('create', (a) =>
      a
        .title('Create orders')
        .grant(
          'orders',
          orders.create([
            'id',
            'customerId',
            'reference',
            'items',
            'note',
            'status',
          ]),
        )
        .grant('customers', customers),
    )
    .action('update', (a) =>
      a
        .title('Edit orders')
        .grant(
          'orders',
          orders.update(['customerId', 'reference', 'items', 'note']),
        )
        .grant('customers', customers),
    ),
);
