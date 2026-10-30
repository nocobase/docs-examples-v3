import {
  defineCompositeResource,
  defineRecordAccess,
} from '@nocobase/authorization/core';
import { defineDatabasePermission } from '@nocobase/app-plugin-authorization/server';
import { buildFilter } from '@nocobase/repository-input';
import metadata from '../../package.json' with { type: 'json' };
import type { DeviceRow } from '../devices/schemas.js';
import type { RequestRow } from './schemas.js';

export const label = (key: string) => ({
  ns: metadata.name,
  key: `requests.${key}`,
});

const fields = [
  'id',
  'requestNo',
  'requesterId',
  'category',
  'reason',
  'status',
  'needsApproval',
  'decisionComment',
  'decidedById',
  'deviceId',
  'issuedById',
  'lifecycleVersion',
  'statusChangedAt',
  'createdAt',
  'updatedAt',
] as const;

const requests = defineDatabasePermission((p) =>
  p.collection<RequestRow>('deviceRequests').title(label('title')).read(fields),
);
const devices = defineDatabasePermission((p) =>
  p
    .collection<DeviceRow>('devices')
    .title({ ns: metadata.name, key: 'devices.title' })
    .read(['id', 'assetTag', 'name', 'category', 'status', 'assigneeId']),
);

/** The requests a person submitted. */
export const ownRequests = defineRecordAccess('deviceRequests.mine', (access) =>
  access
    .title(label('mineScope'))
    .collections('deviceRequests')
    .resolver(({ principal }) =>
      principal.type === 'user'
        ? buildFilter((f) => f.string('requesterId').eq(principal.id))
        : false,
    ),
);

/**
 * One business action per independently assignable operation (docs/design.md §6). The lifecycle runtime writes the
 * state; these grants decide which records a person may act on.
 */
export const requestPermissions = defineCompositeResource(
  'deviceRequests',
  (r) =>
    r
      .title(label('title'))
      .action('read', (a) =>
        a.title(label('readPermission')).grant('deviceRequests', requests),
      )
      .action('create', (a) =>
        a
          .title(label('createPermission'))
          .grant('deviceRequests', requests.create(fields)),
      )
      .action('approve', (a) =>
        a
          .title(label('approvePermission'))
          .grant(
            'deviceRequests',
            requests.update([
              'status',
              'decisionComment',
              'decidedById',
              'updatedAt',
            ]),
          ),
      )
      .action('issue', (a) =>
        a
          .title(label('issuePermission'))
          .grant(
            'deviceRequests',
            requests.update(['status', 'deviceId', 'issuedById', 'updatedAt']),
          )
          .grant(
            'devices',
            devices.update(['status', 'assigneeId', 'updatedAt']),
          ),
      )
      .action('withdraw', (a) =>
        a
          .title(label('withdrawPermission'))
          .grant('deviceRequests', requests.update(['status', 'updatedAt'])),
      ),
);

export type RequestAction =
  'read' | 'create' | 'approve' | 'issue' | 'withdraw';
