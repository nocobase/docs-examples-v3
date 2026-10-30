import { randomUUID } from 'node:crypto';
import { ApiError } from '@nocobase/app-server/router';
import type { AuthorizationContext } from '@nocobase/authorization/core';
import type {
  DatabaseConnection,
  DatabaseManager,
  RepositoryPolicy,
} from '@nocobase/db';
import { buildFilter } from '@nocobase/repository-input';
import type { UserAdministrationService } from '@nocobase/app-plugin-authentication/server';
import {
  rowSchema,
  type Device,
  type DeviceInput,
  type DeviceQuery,
  type DeviceRow,
} from './schemas.js';
import type { DeviceAction } from './permissions.js';

type DeviceErrorStatus =
  'NOT_FOUND' | 'PERMISSION_DENIED' | 'INVALID_ARGUMENT' | 'ALREADY_EXISTS';

export const deviceError = (
  status: DeviceErrorStatus,
  reason: string,
  field?: string,
) =>
  new ApiError({
    status,
    reason,
    domain: 'devices',
    message: reason,
    ...(field ? { fieldViolations: [{ field, description: reason }] } : {}),
  });

export class DeviceService {
  constructor(
    private readonly db: DatabaseManager | DatabaseConnection,
    private readonly users: UserAdministrationService,
  ) {}

  /** The same service reading and writing through `connection`, such as the transaction of a submission receipt. */
  withConnection(connection: DatabaseConnection): DeviceService {
    return new DeviceService(connection, this.users.withConnection(connection));
  }

  /** The record policy a person holds for one device action; refuses when the action is not granted. */
  async policy(
    authz: AuthorizationContext,
    action: DeviceAction,
  ): Promise<RepositoryPolicy> {
    const decision = await authz.authorize({
      resource: { type: 'composite', id: 'devices' },
      action,
    });
    const policy = decision.conditions?.database?.devices;
    if (decision.effect === 'deny' || !policy)
      throw deviceError('PERMISSION_DENIED', 'DEVICE_ACTION_DENIED');
    return policy;
  }

  async optionalPolicy(authz: AuthorizationContext, action: DeviceAction) {
    const decision = await authz.authorize({
      resource: { type: 'composite', id: 'devices' },
      action,
    });
    return decision.effect === 'deny'
      ? undefined
      : decision.conditions?.database?.devices;
  }

  async find(policy: RepositoryPolicy, id: string): Promise<DeviceRow> {
    const row = await this.db
      .repository('devices')
      .withPolicy(policy)
      .findOne({ filter: { id } });
    if (!row) throw deviceError('NOT_FOUND', 'DEVICE_NOT_FOUND');
    return rowSchema.parse(row);
  }

  /** Adds the assignee's name and what the person may do with each row, with a fixed number of queries per page. */
  async present(
    rows: DeviceRow[],
    authz: AuthorizationContext,
  ): Promise<Device[]> {
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    const userIds = [
      ...new Set(
        rows.flatMap((row) => (row.assigneeId ? [row.assigneeId] : [])),
      ),
    ];
    const names = new Map(
      (userIds.length
        ? (await this.users.list({ userIds, pageSize: 100 })).items
        : []
      ).map((u) => [u.id, u.name]),
    );
    const allowed = await Promise.all(
      (['edit', 'delete'] as const).map(async (action) => {
        const policy = await this.optionalPolicy(authz, action);
        if (!policy) return new Set<string>();
        const records = await this.db
          .repository('devices')
          .withPolicy(policy)
          .findMany({
            filter: (f) => f.or(ids.map((id) => f.string('id').eq(id))),
            select: (s) => s.fields('id'),
          });
        return new Set(records.map((row) => row.id as string));
      }),
    );
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      assigneeName: row.assigneeId ? (names.get(row.assigneeId) ?? null) : null,
      permissions: {
        edit: allowed[0].has(row.id),
        delete: allowed[1].has(row.id),
      },
    }));
  }

  async list(
    policy: RepositoryPolicy,
    query: DeviceQuery,
    authz: AuthorizationContext,
  ) {
    const repository = this.db.repository('devices').withPolicy(policy);
    const filter = buildFilter((f) =>
      f.and([
        ...(query.q
          ? [
              f.or([
                f.string('assetTag').includes(query.q),
                f.string('name').includes(query.q),
                f.string('serialNumber').includes(query.q),
              ]),
            ]
          : []),
        ...(query.status ? [f.string('status').eq(query.status)] : []),
        ...(query.category ? [f.string('category').eq(query.category)] : []),
      ]),
    );
    const total = await repository.count({ filter });
    const page = Math.min(
      query.page,
      Math.max(1, Math.ceil(total / query.pageSize)),
    );
    const [field, direction] = query.orderBy.split(':');
    const rows = await repository.findMany({
      filter,
      limit: query.pageSize,
      offset: (page - 1) * query.pageSize,
      sort: (s) => [
        s.field(field)[direction === 'asc' ? 'asc' : 'desc']().nullsLast(),
        s.field('id').asc(),
      ],
    });
    return {
      data: await this.present(
        rows.map((r) => rowSchema.parse(r)),
        authz,
      ),
      meta: { total, page, pageSize: query.pageSize },
    };
  }

  async people(query: { page: number; pageSize: number; q: string }) {
    const result = await this.users.list({
      page: query.page,
      pageSize: query.pageSize,
      search: query.q,
      status: 'enabled',
    });
    return {
      data: result.items.map(({ id, name }) => ({ id, name })),
      meta: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      },
    };
  }

  /** The rules a form cannot express in one field: an in-use device has a person, any other status has none. */
  private async validate(input: DeviceInput, id?: string) {
    if (input.status === 'inUse' && !input.assigneeId)
      throw deviceError(
        'INVALID_ARGUMENT',
        'DEVICE_ASSIGNEE_REQUIRED',
        'assigneeId',
      );
    if (input.status !== 'inUse' && input.assigneeId)
      throw deviceError(
        'INVALID_ARGUMENT',
        'DEVICE_ASSIGNEE_NOT_ALLOWED',
        'assigneeId',
      );
    if (input.assigneeId) {
      const user = await this.users.get(input.assigneeId);
      if (!user || user.disabledAt || user.kind !== 'person')
        throw deviceError(
          'INVALID_ARGUMENT',
          'DEVICE_ASSIGNEE_INVALID',
          'assigneeId',
        );
    }
    // Uniqueness is checked across every device, including ones the person cannot see, so the message names the field
    // instead of surfacing a database constraint error. The unique indexes still guard concurrent writes.
    const repository = this.db.repository('devices');
    const taken = (field: 'assetTag' | 'serialNumber', value: string) =>
      repository.count({
        filter: buildFilter((f) =>
          f.and([
            f.string(field).eq(value),
            ...(id ? [f.string('id').ne(id)] : []),
          ]),
        ),
      });
    if (await taken('assetTag', input.assetTag))
      throw deviceError('ALREADY_EXISTS', 'DEVICE_ASSET_TAG_TAKEN', 'assetTag');
    if (input.serialNumber && (await taken('serialNumber', input.serialNumber)))
      throw deviceError(
        'ALREADY_EXISTS',
        'DEVICE_SERIAL_NUMBER_TAKEN',
        'serialNumber',
      );
  }

  async create(policy: RepositoryPolicy, input: DeviceInput) {
    await this.validate(input);
    const now = new Date();
    const result = await this.db
      .repository('devices')
      .withPolicy(policy)
      .createOne({
        values: { ...input, id: randomUUID(), createdAt: now, updatedAt: now },
      });
    return rowSchema.parse(result.record);
  }

  async update(policy: RepositoryPolicy, id: string, input: DeviceInput) {
    await this.find(policy, id);
    await this.validate(input, id);
    const result = await this.db
      .repository('devices')
      .withPolicy(policy)
      .updateOne({
        filter: { id },
        values: { ...input, updatedAt: new Date() },
      });
    return rowSchema.parse(result.record);
  }

  async remove(policy: RepositoryPolicy, id: string) {
    const row = await this.find(policy, id);
    await this.db
      .repository('devices')
      .withPolicy(policy)
      .deleteOne({ filter: { id } });
    return row;
  }
}
