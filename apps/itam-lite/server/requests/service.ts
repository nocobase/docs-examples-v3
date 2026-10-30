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
  LifecycleError,
  lifecycleErrorFields,
  type LifecycleRuntime,
} from '@nocobase/lifecycle';
import { REQUEST_LIFECYCLE } from './lifecycle.js';
import type { RequestAction } from './permissions.js';
import {
  rowSchema,
  type DeviceRequest,
  type RequestRow,
  type RequestState,
} from './schemas.js';
import type { DeviceCategory } from '../devices/schemas.js';

/** A column value as text: database rows are typed loosely. */
const text = (value: unknown): string =>
  typeof value === 'string'
    ? value
    : typeof value === 'number' || typeof value === 'bigint'
      ? String(value)
      : '';

/** Business dates are calendar days in the company's time zone (docs/design.md §1: the company is in Shanghai). */
export const BUSINESS_TIME_ZONE = 'Asia/Shanghai';

/** Today as `YYYY-MM-DD` in the business time zone, not the server's. */
export const businessToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

export const requestError = (
  status:
    | 'NOT_FOUND'
    | 'PERMISSION_DENIED'
    | 'INVALID_ARGUMENT'
    | 'FAILED_PRECONDITION',
  reason: string,
  field?: string,
) =>
  new ApiError({
    status,
    reason,
    domain: 'deviceRequests',
    message: reason,
    ...(field ? { fieldViolations: [{ field, description: reason }] } : {}),
  });

/** A lifecycle refusal as the standard error body; anything else is rethrown as it is. */
export function toApiError(error: unknown): unknown {
  if (!(error instanceof LifecycleError)) return error;
  const fields = lifecycleErrorFields(error, { inputField: 'input' });
  return fields ? new ApiError({ ...fields, domain: 'deviceRequests' }) : error;
}

export class DeviceRequestService {
  constructor(
    private readonly db: DatabaseManager | DatabaseConnection,
    private readonly users: UserAdministrationService,
    private readonly runtime: LifecycleRuntime,
  ) {}

  /** The same service reading through `connection`, such as the transaction of a submission receipt. */
  withConnection(connection: DatabaseConnection): DeviceRequestService {
    return new DeviceRequestService(
      connection,
      this.users.withConnection(connection),
      this.runtime,
    );
  }

  async policy(
    authz: AuthorizationContext,
    action: RequestAction,
  ): Promise<RepositoryPolicy> {
    const policy = await this.optionalPolicy(authz, action);
    if (!policy)
      throw requestError('PERMISSION_DENIED', 'REQUEST_ACTION_DENIED');
    return policy;
  }

  async optionalPolicy(
    authz: AuthorizationContext,
    action: RequestAction,
    collection = 'deviceRequests',
  ) {
    const decision = await authz.authorize({
      resource: { type: 'composite', id: 'deviceRequests' },
      action,
    });
    return decision.effect === 'deny'
      ? undefined
      : decision.conditions?.database?.[collection];
  }

  async find(policy: RepositoryPolicy, id: string): Promise<RequestRow> {
    const row = await this.db
      .repository('deviceRequests')
      .withPolicy(policy)
      .findOne({ filter: { id } });
    if (!row) throw requestError('NOT_FOUND', 'REQUEST_NOT_FOUND');
    return rowSchema.parse(row);
  }

  async present(rows: RequestRow[]): Promise<DeviceRequest[]> {
    if (!rows.length) return [];
    const userIds = [
      ...new Set(
        rows.flatMap((row) => [row.requesterId, row.decidedById ?? []].flat()),
      ),
    ];
    const names = new Map(
      (await this.users.list({ userIds, pageSize: 100 })).items.map((user) => [
        user.id,
        user.name,
      ]),
    );
    const deviceIds = rows.flatMap((row) =>
      row.deviceId ? [row.deviceId] : [],
    );
    const tags = new Map(
      deviceIds.length
        ? (
            await this.db.repository('devices').findMany({
              filter: (f) => f.or(deviceIds.map((id) => f.string('id').eq(id))),
              select: (s) => s.fields('id', 'assetTag'),
            })
          ).map((row) => [text(row.id), text(row.assetTag)])
        : [],
    );
    return rows.map((row) => ({
      ...row,
      statusChangedAt: row.statusChangedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      requesterName: names.get(row.requesterId) ?? null,
      decidedByName: row.decidedById
        ? (names.get(row.decidedById) ?? null)
        : null,
      deviceAssetTag: row.deviceId ? (tags.get(row.deviceId) ?? null) : null,
    }));
  }

  async list(
    policy: RepositoryPolicy,
    query: {
      status?: RequestState;
      mine: boolean;
      page: number;
      pageSize: number;
    },
    userId: string,
  ) {
    const repository = this.db.repository('deviceRequests').withPolicy(policy);
    const filter = buildFilter((f) =>
      f.and([
        ...(query.status ? [f.string('status').eq(query.status)] : []),
        ...(query.mine ? [f.string('requesterId').eq(userId)] : []),
      ]),
    );
    const total = await repository.count({ filter });
    const page = Math.min(
      query.page,
      Math.max(1, Math.ceil(total / query.pageSize)),
    );
    const rows = await repository.findMany({
      filter,
      limit: query.pageSize,
      offset: (page - 1) * query.pageSize,
      sort: (s) => [s.field('createdAt').desc(), s.field('id').desc()],
    });
    return {
      data: await this.present(rows.map((row) => rowSchema.parse(row))),
      meta: { total, page, pageSize: query.pageSize },
    };
  }

  /**
   * Creates the request and submits it in `transaction`, the caller's (the submission receipt's), so a retried
   * submission never creates a second request. The lifecycle decides whether it needs approval from the
   * administrator-set rules and the number of devices the requester already uses, counted here inside the transaction.
   */
  async submit(
    input: {
      category: DeviceCategory;
      reason: string;
      neededBy: string | null;
    },
    userId: string,
    requestId: string | undefined,
    transaction: DatabaseConnection,
  ) {
    const actor = { id: userId };
    if (input.neededBy && input.neededBy < businessToday())
      throw requestError(
        'INVALID_ARGUMENT',
        'REQUEST_NEEDED_BY_PAST',
        'neededBy',
      );
    const count = await transaction.repository('deviceRequests').count({});
    const now = new Date();
    const id = randomUUID();
    await this.runtime.create(
      REQUEST_LIFECYCLE,
      {
        id,
        requestNo: `REQ-${String(count + 1).padStart(4, '0')}`,
        requesterId: userId,
        category: input.category,
        reason: input.reason,
        neededBy: input.neededBy,
        needsApproval: false,
        decisionComment: '',
        createdAt: now,
        updatedAt: now,
      },
      { actor, transaction },
    );
    const heldDevices = await transaction.repository('devices').count({
      filter: buildFilter((f) =>
        f.and([
          f.string('assigneeId').eq(userId),
          f.string('status').eq('inUse'),
        ]),
      ),
    });
    await this.runtime.fire(REQUEST_LIFECYCLE, id, 'submit', {
      actor,
      manual: true,
      input: { heldDevices },
      ...(requestId ? { requestId } : {}),
      transaction,
    });
    return id;
  }

  /**
   * Issuing writes the device with the request: the device must be in stock and of the requested category, and it
   * becomes in use by the requester in the same transaction as the state change.
   */
  async issue(
    row: RequestRow,
    deviceId: string,
    devicePolicy: RepositoryPolicy,
    userId: string,
    requestId: string | undefined,
    expectVersion: number | undefined,
    transaction: DatabaseConnection,
  ) {
    const device = await transaction
      .repository('devices')
      .withPolicy(devicePolicy)
      .findOne({ filter: { id: deviceId } });
    if (
      !device ||
      device.status !== 'inStock' ||
      device.category !== row.category
    )
      throw requestError(
        'INVALID_ARGUMENT',
        'REQUEST_DEVICE_UNAVAILABLE',
        'input.deviceId',
      );
    await this.runtime.fire(REQUEST_LIFECYCLE, row.id, 'issue', {
      actor: { id: userId },
      manual: true,
      input: { deviceId },
      ...(requestId ? { requestId } : {}),
      ...(expectVersion === undefined
        ? {}
        : { expect: { version: expectVersion } }),
      transaction,
    });
    await transaction
      .repository('devices')
      .withPolicy(devicePolicy)
      .updateOne({
        filter: { id: deviceId },
        values: {
          status: 'inUse',
          assigneeId: row.requesterId,
          updatedAt: new Date(),
        },
      });
  }

  async fire(
    row: RequestRow,
    transition: 'approve' | 'reject' | 'withdraw',
    input: Record<string, string>,
    userId: string,
    requestId: string | undefined,
    expectVersion: number | undefined,
    transaction: DatabaseConnection,
  ) {
    await this.runtime.fire(REQUEST_LIFECYCLE, row.id, transition, {
      actor: { id: userId },
      manual: true,
      input,
      ...(requestId ? { requestId } : {}),
      ...(expectVersion === undefined
        ? {}
        : { expect: { version: expectVersion } }),
      transaction,
    });
  }

  /** In-stock devices of the request's category, for the issue form. */
  async issuable(row: RequestRow, devicePolicy: RepositoryPolicy) {
    const rows = await this.db
      .repository('devices')
      .withPolicy(devicePolicy)
      .findMany({
        filter: buildFilter((f) =>
          f.and([
            f.string('status').eq('inStock'),
            f.string('category').eq(row.category),
          ]),
        ),
        select: (s) => s.fields('id', 'assetTag', 'name'),
        sort: (s) => [s.field('assetTag').asc()],
        limit: 100,
      });
    return rows.map((device) => ({
      id: text(device.id),
      assetTag: text(device.assetTag),
      name: text(device.name),
    }));
  }
}
