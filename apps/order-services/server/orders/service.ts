import type { DatabaseManager, RepositoryPolicy } from '@nocobase/db';

export interface OrderView {
  id: string;
  ownerId: string;
  productId: string;
  quantity: number;
  status: string;
}
export interface ConfirmationPolicies {
  orders: RepositoryPolicy;
  products: RepositoryPolicy;
}
export class OrderError extends Error {
  constructor(
    public readonly code:
      'ORDER_UNAVAILABLE' | 'OUT_OF_STOCK' | 'ORDER_CONFLICT',
  ) {
    super(code);
  }
}
export interface OrderService {
  get(policy: RepositoryPolicy, orderId: string): Promise<OrderView>;
  confirm(policies: ConfirmationPolicies, orderId: string): Promise<OrderView>;
}
export class DefaultOrderService implements OrderService {
  constructor(
    private readonly database: DatabaseManager,
    private readonly onConfirmed: (order: OrderView) => void | Promise<void>,
  ) {}

  async get(policy: RepositoryPolicy, orderId: string): Promise<OrderView> {
    const row = await this.database
      .repository('orders')
      .withPolicy(policy)
      .findOne({ filter: { id: orderId } });
    if (!row) throw new OrderError('ORDER_UNAVAILABLE');
    return view(row);
  }

  async confirm(
    policies: ConfirmationPolicies,
    orderId: string,
  ): Promise<OrderView> {
    return this.database.transaction(async (connection) => {
      const orders = connection
        .repository('orders')
        .withPolicy(policies.orders);
      const products = connection
        .repository('products')
        .withPolicy(policies.products);
      const row = await orders.findOne({ filter: { id: orderId } });
      if (!row) throw new OrderError('ORDER_UNAVAILABLE');
      const order = view(row);
      // A repeated confirmation returns the committed result without deducting stock again.
      if (order.status === 'confirmed') return order;
      if (!Number.isSafeInteger(order.quantity) || order.quantity <= 0)
        throw new OrderError('ORDER_CONFLICT');
      if (order.status !== 'draft') throw new OrderError('ORDER_CONFLICT');
      try {
        await orders.updateOne({
          filter: { id: order.id, status: 'draft' },
          values: { status: 'confirmed' },
        });
        const product = await products.findOne({
          filter: { id: order.productId },
        });
        if (!product || Number(product.stock) < order.quantity)
          throw new OrderError('OUT_OF_STOCK');
        // Compare-and-set prevents two orders from silently overwriting the same stock balance.
        await products.updateOne({
          filter: { id: order.productId, stock: Number(product.stock) },
          values: { stock: Number(product.stock) - order.quantity },
        });
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'RECORD_NOT_FOUND'
        ) {
          throw new OrderError('ORDER_CONFLICT');
        }
        throw error;
      }
      const result = { ...order, status: 'confirmed' };
      connection.afterCommit(() => this.onConfirmed(result));
      return result;
    });
  }
}
function view(row: Record<string, unknown>): OrderView {
  return {
    id: String(row.id),
    ownerId: String(row.ownerId),
    productId: String(row.productId),
    quantity: Number(row.quantity),
    status: String(row.status),
  };
}
