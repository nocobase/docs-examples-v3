import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { DatabaseConnection, RepositoryPolicy } from '@nocobase/db';
import { ApiError } from '@nocobase/app-server/router';
export const Customer = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  notes: z.string(),
  ownerId: z.string(),
});
export const Order = z.object({
  id: z.string(),
  number: z.string(),
  customerId: z.string(),
  ownerId: z.string(),
});
export interface CustomerValues {
  name: string;
  email: string;
  notes: string;
}
export interface AccessPolicies {
  customers?: RepositoryPolicy;
  orders?: RepositoryPolicy;
}
export function unavailable(kind: 'customer' | 'order') {
  return new ApiError({
    status: 'NOT_FOUND',
    reason: 'RECORD_UNAVAILABLE',
    domain: 'customer-access',
    message: `The ${kind} is unavailable.`,
  });
}
export class CustomerAccessService {
  constructor(readonly connection: DatabaseConnection) {}
  async list(
    policy: RepositoryPolicy,
    collection: 'accessCustomers' | 'accessOrders',
    page: number,
    pageSize: number,
    q = '',
    descending = false,
  ) {
    const repo = this.connection.repository(collection).withPolicy(policy);
    const field = collection === 'accessCustomers' ? 'name' : 'number';
    const filter: NonNullable<Parameters<typeof repo.count>[0]>['filter'] = (
      f,
    ) => f.string(field).includes(q, { mode: 'insensitive' });
    const data = await repo.findMany({
      filter,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sort: (s) => [
        descending ? s.field(field).desc() : s.field(field).asc(),
        s.field('id').asc(),
      ],
    });
    const total = await repo.count({ filter });
    return { data, meta: { page, pageSize, total } };
  }
  async get(
    policy: RepositoryPolicy,
    id: string,
    connection = this.connection,
  ) {
    const row = await connection
      .repository('accessCustomers')
      .withPolicy(policy)
      .findOne({ filter: { id } });
    if (!row) throw unavailable('customer');
    return row;
  }
  async create(
    policy: RepositoryPolicy,
    ownerId: string,
    values: CustomerValues,
    connection: DatabaseConnection,
  ) {
    const result = await connection
      .repository('accessCustomers')
      .withPolicy(policy)
      .createOne({ values: { ...values, id: randomUUID(), ownerId } });
    return Customer.parse(result.record);
  }
  async edit(
    policy: RepositoryPolicy,
    id: string,
    values: CustomerValues,
    connection: DatabaseConnection,
  ) {
    await this.get(policy, id, connection);
    const result = await connection
      .repository('accessCustomers')
      .withPolicy(policy)
      .updateOne({ filter: { id }, values: { ...values } });
    if (!result.record) throw unavailable('customer');
    return Customer.parse(result.record);
  }
  async getOrder(
    policy: RepositoryPolicy,
    id: string,
    connection = this.connection,
  ) {
    const row = await connection
      .repository('accessOrders')
      .withPolicy(policy)
      .findOne({ filter: { id } });
    if (!row) throw unavailable('order');
    return row;
  }
  async assign(
    policies: { customers: RepositoryPolicy; orders: RepositoryPolicy },
    id: string,
    customerId: string,
    transaction: DatabaseConnection,
  ) {
    const orders = transaction
      .repository('accessOrders')
      .withPolicy(policies.orders);
    await this.getOrder(policies.orders, id, transaction);
    const customer = await transaction
      .repository('accessCustomers')
      .withPolicy(policies.customers)
      .findOne({ filter: { id: customerId } });
    if (!customer)
      throw new ApiError({
        status: 'INVALID_ARGUMENT',
        reason: 'CUSTOMER_UNAVAILABLE',
        domain: 'customer-access',
        message: 'The selected customer is unavailable.',
      });
    const result = await orders.updateOne({
      filter: { id },
      values: { customerId },
    });
    if (!result.record) throw unavailable('order');
    return Order.parse(result.record);
  }
}
