import { randomUUID } from 'node:crypto';
import type { DatabaseManager, RepositoryPolicy } from '@nocobase/db';

export interface OrderInput {
  customerId: string;
  reference: string;
  items: { name: string; quantity: number }[];
  note?: string | null;
}
export interface OrderView extends Omit<OrderInput, 'note'> {
  id: string;
  note: string | null;
  status: 'draft' | 'confirmed';
}
export interface OrderPolicies {
  orders: RepositoryPolicy;
  customers: RepositoryPolicy;
}
export class OrderMissingError extends Error {
  constructor() {
    super('The requested order was not found.');
  }
}
export class CustomerUnavailableError extends Error {
  constructor() {
    super('Choose an available customer.');
  }
}
export class OrderLockedError extends Error {
  constructor() {
    super('A confirmed order cannot be edited.');
  }
}

export class OrderService {
  constructor(private readonly database: DatabaseManager) {}

  async list(
    policy: RepositoryPolicy,
    input: { page: number; pageSize: number },
  ) {
    const orders = this.database.repository('orders').withPolicy(policy);
    const rows = await orders.findMany({
      sort: (s) => [s.field('id').asc()],
      limit: input.pageSize,
      offset: (input.page - 1) * input.pageSize,
    });
    return {
      data: rows.map(toOrderView),
      meta: { ...input, total: await orders.count() },
    };
  }

  async get(policy: RepositoryPolicy, id: string): Promise<OrderView> {
    const row = await this.database
      .repository('orders')
      .withPolicy(policy)
      .findOne({ filter: { id } });
    if (!row) throw new OrderMissingError();
    return toOrderView(row);
  }

  async create(policies: OrderPolicies, input: OrderInput): Promise<OrderView> {
    return this.database.transaction(async (connection) => {
      const customer = await connection
        .repository('customers')
        .withPolicy(policies.customers)
        .findOne({ filter: { id: input.customerId } });
      if (!customer) throw new CustomerUnavailableError();
      const row = await connection
        .repository('orders')
        .withPolicy(policies.orders)
        .createOne({
          values: {
            ...input,
            id: randomUUID(),
            note: input.note ?? null,
            status: 'draft',
          },
        });
      return toOrderView(row.record);
    });
  }

  async update(
    policies: OrderPolicies,
    id: string,
    input: Partial<OrderInput>,
  ): Promise<OrderView> {
    return this.database.transaction(async (connection) => {
      const orders = connection
        .repository('orders')
        .withPolicy(policies.orders);
      const current = await orders.findOne({ filter: { id } });
      if (!current) throw new OrderMissingError();
      if (current.status !== 'draft') throw new OrderLockedError();
      if (input.customerId !== undefined) {
        const customer = await connection
          .repository('customers')
          .withPolicy(policies.customers)
          .findOne({ filter: { id: input.customerId } });
        if (!customer) throw new CustomerUnavailableError();
      }
      // Guard the write too, so a concurrent confirmation cannot be overwritten.
      const row = await orders.updateOne({
        filter: { id, status: 'draft' },
        values: input,
      });
      return toOrderView(row.record);
    });
  }
}

function toOrderView(row: Record<string, unknown>): OrderView {
  // Select the public fields explicitly; response declarations do not filter data.
  return {
    id: String(row.id),
    customerId: String(row.customerId),
    reference: String(row.reference),
    items: row.items as OrderView['items'],
    note: row.note == null ? null : String(row.note),
    status: row.status as OrderView['status'],
  };
}
