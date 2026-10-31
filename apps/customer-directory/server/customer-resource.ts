import { defineCompositeResource } from '@nocobase/authorization/core';
import { defineDatabasePermission } from '@nocobase/app-plugin-authorization/server';
const title = (key: string) => ({
  key: `customers.${key}`,
  ns: 'customer-directory',
});
const data = defineDatabasePermission((p) =>
  p.collection('customers').read(['id', 'name', 'contact', 'email', 'status']),
);
export const customerResource = defineCompositeResource('customers', (r) =>
  r
    .title(title('title'))
    .action('view', (a) => a.title(title('details')).grant('customers', data))
    .action('create', (a) =>
      a
        .title(title('new'))
        .grant(
          'customers',
          data.create(['id', 'name', 'contact', 'email', 'status']),
        ),
    )
    .action('edit', (a) =>
      a
        .title(title('edit'))
        .grant(
          'customers',
          data.update(['name', 'contact', 'email', 'status']),
        ),
    )
    .action('delete', (a) =>
      a.title(title('delete')).grant('customers', data.delete()),
    ),
);
