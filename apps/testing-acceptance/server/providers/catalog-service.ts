import { buildFilter } from '@nocobase/repository-input';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { DatabaseConnection, RepositoryPolicy } from '@nocobase/db';
export const ProductSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  priceCents: z.number().int(),
  published: z.boolean(),
});
export type Product = z.infer<typeof ProductSchema>;
export class ProductNotFound extends Error {}
export class ProductAlreadyPublished extends Error {}
export const publicProductPolicy: RepositoryPolicy = {
  read: {
    scope: buildFilter((f) => f.boolean('published').isTrue()),
    fields: ['id', 'name', 'priceCents', 'published'],
  },
  create: false,
  update: false,
  delete: false,
};
export class CatalogService {
  constructor(readonly connection: DatabaseConnection) {}
  repository(policy: RepositoryPolicy, connection = this.connection) {
    return connection.repository<Product>('catalogProducts').withPolicy(policy);
  }
  async list(
    policy: RepositoryPolicy,
    input: { q: string; page: number; pageSize: number },
  ) {
    const repository = this.repository(policy);
    const filter: NonNullable<
      Parameters<typeof repository.count>[0]
    >['filter'] = (f) =>
      f.string('name').includes(input.q, { mode: 'insensitive' });
    // The same policy and filter apply to both the rows and the total.
    const [data, total] = await Promise.all([
      repository.findMany({
        filter,
        limit: input.pageSize,
        offset: (input.page - 1) * input.pageSize,
        sort: (s) => [s.field('name').asc(), s.field('id').asc()],
      }),
      repository.count({ filter }),
    ]);
    return {
      data: data.map((record) => ProductSchema.parse(record)),
      meta: { page: input.page, pageSize: input.pageSize, total },
    };
  }
  async get(
    policy: RepositoryPolicy,
    id: string,
    connection = this.connection,
  ) {
    const record = await this.repository(policy, connection).findOne({
      filter: { id },
    });
    if (!record) throw new ProductNotFound('Product not found.');
    return ProductSchema.parse(record);
  }
  async create(
    policy: RepositoryPolicy,
    values: { name: string; priceCents: number },
    transaction: DatabaseConnection,
  ) {
    const result = await this.repository(policy, transaction).createOne({
      values: { id: randomUUID(), ...values, published: false },
    });
    return ProductSchema.parse(result.record);
  }
  async publish(
    policy: RepositoryPolicy,
    id: string,
    transaction: DatabaseConnection,
  ) {
    const record = await this.get(policy, id, transaction);
    if (record.published)
      throw new ProductAlreadyPublished('Product is already published.');
    // The condition prevents a second concurrent caller from publishing the same draft.
    const result = await this.repository(policy, transaction).updateOne({
      filter: (f) =>
        f.and([f.string('id').eq(id), f.boolean('published').isFalse()]),
      values: { published: true },
    });
    return ProductSchema.parse(result.record);
  }
}
