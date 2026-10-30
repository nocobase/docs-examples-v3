import { ApiError } from '@nocobase/app-server/router';
import type { DatabaseManager } from '@nocobase/db';
import type { UserAdministrationService } from '@nocobase/app-plugin-authentication/server';
import {
  lifecycleDescriptionViewAsync,
  normalizeParameterValues,
  type JsonObject,
  type LifecycleParameterStore,
  type LifecycleRuntime,
} from '@nocobase/lifecycle';
import {
  approvalRules,
  deviceRequestLifecycle,
  REQUEST_LIFECYCLE,
} from '../requests/lifecycle.js';

/** The workflows this application runs: one lifecycle, its record table and the field its state lives in. */
const WORKFLOWS = [
  {
    id: REQUEST_LIFECYCLE,
    collection: 'deviceRequests',
    titleField: 'requestNo',
  },
] as const;

/** A column value as text: database rows are typed loosely. */
const text = (value: unknown): string =>
  typeof value === 'string'
    ? value
    : typeof value === 'number' || typeof value === 'bigint'
      ? String(value)
      : '';

const notFound = (reason: string) =>
  new ApiError({
    status: 'NOT_FOUND',
    reason,
    domain: 'workflows',
    message: reason,
  });

const iso = (value: unknown) =>
  value instanceof Date ? value.toISOString() : text(value);

/**
 * Reads the application's real definitions and executions for System settings → Workflow management, and saves the
 * administrator-set parameters. Management never fires a transition.
 */
export class WorkflowService {
  constructor(
    private readonly db: DatabaseManager,
    private readonly runtime: LifecycleRuntime,
    private readonly parameters: LifecycleParameterStore,
    private readonly scope: string,
    private readonly users: UserAdministrationService,
  ) {}

  private resolve(id: string) {
    const workflow = WORKFLOWS.find((item) => item.id === id);
    if (!workflow) throw notFound('WORKFLOW_NOT_FOUND');
    return workflow;
  }

  private async stats(id: string) {
    const repository = this.db.repository(this.resolve(id).collection);
    const [executionCount, latest] = await Promise.all([
      repository.count({}),
      repository.findMany({
        select: (s) => s.fields('createdAt'),
        sort: (s) => [s.field('createdAt').desc()],
        limit: 1,
      }),
    ]);
    return {
      executionCount,
      lastExecutedAt: latest[0] ? iso(latest[0].createdAt) : null,
    };
  }

  async definitions() {
    return Promise.all(
      WORKFLOWS.map(async ({ id }) => {
        const description = this.runtime.describe(id);
        return {
          id,
          name: id,
          states: description.states.length,
          transitions: description.transitions.length,
          ...(await this.stats(id)),
        };
      }),
    );
  }

  async definition(id: string) {
    this.resolve(id);
    const [summary] = (await this.definitions()).filter(
      (item) => item.id === id,
    );
    return {
      workflow: summary,
      ...(await lifecycleDescriptionViewAsync(this.runtime, id, {
        record: null,
        transactionHandle: undefined,
      })),
    };
  }

  /** The complete parameter group, as saved or from the code defaults when nobody has saved it yet. */
  async readParameters(id: string) {
    this.resolve(id);
    const version = await this.parameters.read(this.scope, approvalRules.key);
    const defaults = deviceRequestLifecycle.parameters as unknown as JsonObject;
    return {
      key: approvalRules.key,
      revision: version?.revision ?? 0,
      origin: version ? ('configuration' as const) : ('default' as const),
      values: normalizeParameterValues(
        approvalRules,
        version?.values ?? defaults,
      ),
      updatedBy: version?.actorId ?? null,
      updatedAt: version?.at ?? null,
    };
  }

  /** Saves the complete group only from the revision the editor read; a stale revision is a 409 conflict. */
  async saveParameters(
    id: string,
    values: JsonObject,
    expectedRevision: number,
    requestId: string,
    actorId: string,
  ) {
    this.resolve(id);
    await this.db.connection().transaction((connection) =>
      this.parameters.save(
        {
          scope: this.scope,
          group: approvalRules,
          values: normalizeParameterValues(approvalRules, values),
          expectedRevision,
          requestId,
          actorId,
          at: new Date().toISOString(),
        },
        connection,
      ),
    );
    return this.readParameters(id);
  }

  /** Display names of the people in a history, by user id. */
  async actors(transitions: readonly { actorId: string }[]) {
    const userIds = [...new Set(transitions.map((entry) => entry.actorId))];
    if (!userIds.length) return {};
    const { items } = await this.users.list({ userIds, pageSize: 100 });
    return Object.fromEntries(items.map((user) => [user.id, user.name]));
  }

  async executions(page: number, pageSize: number, workflowId?: string) {
    const { id, collection, titleField } = this.resolve(
      workflowId ?? REQUEST_LIFECYCLE,
    );
    const repository = this.db.repository(collection);
    const [rows, total] = await Promise.all([
      repository.findMany({
        sort: (s) => [s.field('createdAt').desc(), s.field('id').desc()],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      repository.count({}),
    ]);
    return {
      data: rows.map((row) => ({
        workflowId: id,
        recordId: text(row.id),
        title: text(row[titleField]),
        state: text(row.status),
        createdAt: iso(row.createdAt),
        statusChangedAt: iso(row.statusChangedAt),
      })),
      meta: { page, pageSize, total },
    };
  }

  async execution(workflowId: string, recordId: string, actorId: string) {
    const { collection } = this.resolve(workflowId);
    const row = await this.db
      .repository(collection)
      .findOne({ filter: { id: recordId } });
    if (!row) throw notFound('EXECUTION_NOT_FOUND');
    const [definition, view] = await Promise.all([
      this.definition(workflowId),
      this.runtime.view(workflowId, recordId, { id: actorId }),
    ]);
    return {
      ...definition,
      title: text(row.requestNo),
      view,
      actors: await this.actors(view.history.transitions),
    };
  }
}
