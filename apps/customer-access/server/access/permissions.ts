import {
  defineCompositeResource,
  defineRecordAccess,
} from '@nocobase/authorization/core';
import { defineDatabasePermission } from '@nocobase/app-plugin-authorization/server';
import { buildFilter } from '@nocobase/repository-input';
export const title = (key: string) => ({
  key: `access.${key}`,
  ns: 'customer-access',
});
export const ownedRecords = defineRecordAccess('customerAccess.owned', (r) =>
  r
    .title(title('owned'))
    .collections('accessCustomers', 'accessOrders')
    .resolver(({ principal }) =>
      principal.type === 'user'
        ? buildFilter((f) => f.string('ownerId').eq(principal.id))
        : false,
    ),
);
const customers = defineDatabasePermission((p) =>
  p
    .collection('accessCustomers')
    .read(['id', 'name', 'email', 'notes', 'ownerId']),
);
const orders = defineDatabasePermission((p) =>
  p.collection('accessOrders').read(['id', 'number', 'customerId', 'ownerId']),
);
export const accessResource = defineCompositeResource('customerAccess', (r) =>
  r
    .title(title('title'))
    .action('viewCustomers', (a) =>
      a.title(title('viewCustomers')).grant('customers', customers),
    )
    .action('createCustomer', (a) =>
      a
        .title(title('createCustomer'))
        .grant(
          'customers',
          customers.create(['id', 'name', 'email', 'notes', 'ownerId']),
        ),
    )
    .action('editCustomer', (a) =>
      a
        .title(title('editCustomer'))
        .grant('customers', customers.update(['name', 'email', 'notes'])),
    )
    .action('viewOrders', (a) =>
      a.title(title('viewOrders')).grant('orders', orders),
    )
    .action('assignCustomer', (a) =>
      a
        .title(title('assignCustomer'))
        .grant('orders', orders.update(['customerId']))
        .grant('customers', customers),
    ),
);
export type AccessAction =
  | 'viewCustomers'
  | 'createCustomer'
  | 'editCustomer'
  | 'viewOrders'
  | 'assignCustomer';
