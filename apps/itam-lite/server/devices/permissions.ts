import {
  defineCompositeResource,
  defineRecordAccess,
} from '@nocobase/authorization/core';
import { defineDatabasePermission } from '@nocobase/app-plugin-authorization/server';
import { buildFilter } from '@nocobase/repository-input';
import metadata from '../../package.json' with { type: 'json' };
import type { DeviceRow } from './schemas.js';

export const label = (key: string) => ({
  ns: metadata.name,
  key: `devices.${key}`,
});

const fields = [
  'id',
  'assetTag',
  'name',
  'category',
  'serialNumber',
  'status',
  'assigneeId',
  'location',
  'purchaseDate',
  'notes',
  'createdAt',
  'updatedAt',
] as const;

const data = defineDatabasePermission((p) =>
  p.collection<DeviceRow>('devices').title(label('title')).read(fields),
);

/** The devices a person uses: what an employee sees in the register. */
export const assignedDevices = defineRecordAccess(
  'devices.assigned',
  (access) =>
    access
      .title(label('assignedScope'))
      .collections('devices')
      .resolver(({ principal }) =>
        principal.type === 'user'
          ? buildFilter((f) => f.string('assigneeId').eq(principal.id))
          : false,
      ),
);

export const devicePermissions = defineCompositeResource('devices', (r) =>
  r
    .title(label('title'))
    .action('read', (a) =>
      a.title(label('readPermission')).grant('devices', data),
    )
    .action('create', (a) =>
      a.title(label('createPermission')).grant('devices', data.create(fields)),
    )
    .action('edit', (a) =>
      a
        .title(label('editPermission'))
        .grant(
          'devices',
          data.update(fields.filter((f) => f !== 'id' && f !== 'createdAt')),
        ),
    )
    .action('delete', (a) =>
      a.title(label('deletePermission')).grant('devices', data.delete()),
    ),
);

export type DeviceAction = 'read' | 'create' | 'edit' | 'delete';
