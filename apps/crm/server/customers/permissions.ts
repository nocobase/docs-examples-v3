import {
  defineCompositeResource,
  defineRecordAccess,
} from '@nocobase/authorization/core';
import { defineDatabasePermission } from '@nocobase/app-plugin-authorization/server';
import { buildFilter } from '@nocobase/repository-input';
import metadata from '../../package.json' with { type: 'json' };
import type { CustomerRow } from './schemas.js';
export const label = (key: string) => ({
  ns: metadata.name,
  key: `customers.${key}`,
});
const fields = [
  'id',
  'title',
  'contact',
  'description',
  'status',
  'salesOwnerId',
  'nextFollowUpDate',
  'createdAt',
  'updatedAt',
] as const;
const data = defineDatabasePermission((p) =>
  p.collection<CustomerRow>('customers').title(label('title')).read(fields),
);
export const assignedCustomers = defineRecordAccess(
  'customers.assigned',
  (access) =>
    access
      .title(label('assignedScope'))
      .collections('customers')
      .resolver(({ principal }) =>
        principal.type === 'user'
          ? buildFilter((f) => f.string('salesOwnerId').eq(principal.id))
          : false,
      ),
);
export const customerPermissions = defineCompositeResource('customers', (r) =>
  r
    .title(label('title'))
    .action('read', (a) =>
      a.title(label('readPermission')).grant('customers', data),
    )
    .action('create', (a) =>
      a
        .title(label('createPermission'))
        .grant('customers', data.create(fields)),
    )
    .action('edit', (a) =>
      a
        .title(label('editPermission'))
        .grant(
          'customers',
          data.update([
            'title',
            'contact',
            'description',
            'salesOwnerId',
            'nextFollowUpDate',
            'updatedAt',
          ]),
        ),
    )
    .action('progress', (a) =>
      a
        .title(label('progressPermission'))
        .grant('customers', data.update(['status', 'updatedAt'])),
    )
    .action('delete', (a) =>
      a.title(label('deletePermission')).grant('customers', data.delete()),
    ),
);
export type CustomerAction = 'read' | 'create' | 'edit' | 'progress' | 'delete';
