import { randomUUID } from 'node:crypto';
import { ApiError } from '@nocobase/app-server/router';
import type { AuthorizationContext } from '@nocobase/authorization/core';
import type {
  DatabaseConnection,
  DatabaseManager,
  RepositoryPolicy,
} from '@nocobase/db';
import { buildFilter } from '@nocobase/repository-input';
import { projectRow } from './schemas.js';
export class ProjectService {
  constructor(private readonly db: DatabaseManager | DatabaseConnection) {}
  async policy(
    authz: AuthorizationContext,
    action: 'read' | 'create',
  ): Promise<RepositoryPolicy> {
    const decision = await authz.authorize({
      resource: { type: 'composite', id: 'projects' },
      action,
    });
    const policy = decision.conditions?.database?.projects;
    if (decision.effect === 'deny' || !policy)
      throw new ApiError({
        status: 'PERMISSION_DENIED',
        reason: 'PROJECT_ACTION_DENIED',
        domain: 'projects',
        message: 'Project action is not permitted.',
      });
    return policy;
  }
  async list(
    policy: RepositoryPolicy,
    input: { q: string; page: number; pageSize: number },
  ) {
    const repository = this.db.repository('projects').withPolicy(policy);
    const filter = buildFilter((f) =>
      input.q ? f.string('name').includes(input.q) : f.and([]),
    );
    const total = await repository.count({ filter });
    const page = Math.min(
      input.page,
      Math.max(1, Math.ceil(total / input.pageSize)),
    );
    const rows = await repository.findMany({
      filter,
      limit: input.pageSize,
      offset: (page - 1) * input.pageSize,
      sort: (s) => [s.field('createdAt').desc(), s.field('id').asc()],
    });
    return {
      data: rows.map((row) => {
        const parsed = projectRow.parse(row);
        return { ...parsed, createdAt: parsed.createdAt.toISOString() };
      }),
      meta: { total, page, pageSize: input.pageSize },
    };
  }
  async create(policy: RepositoryPolicy, name: string) {
    const result = await this.db
      .repository('projects')
      .withPolicy(policy)
      .createOne({ values: { id: randomUUID(), name, createdAt: new Date() } });
    const row = projectRow.parse(result.record);
    return { ...row, createdAt: row.createdAt.toISOString() };
  }
  async assertVisible(policy: RepositoryPolicy, id: string) {
    if (
      !(await this.db
        .repository('projects')
        .withPolicy(policy)
        .findOne({ filter: { id } }))
    ) {
      throw new ApiError({
        status: 'PERMISSION_DENIED',
        reason: 'PROJECT_ACTION_DENIED',
        domain: 'projects',
        message: 'Project is not accessible.',
      });
    }
  }
}
