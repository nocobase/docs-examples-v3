import { buildFilter } from '@nocobase/repository-input';
import {
  defineCompositeResource,
  defineRecordAccess,
  type AuthorizationContext,
} from '@nocobase/authorization/core';
import { defineDatabasePermission } from '@nocobase/app-plugin-authorization/server';
import type { RepositoryPolicy } from '@nocobase/db';
import type { ConfirmationPolicies } from './service.js';

const orders = defineDatabasePermission((p) =>
  p
    .collection('orders')
    .read(['id', 'ownerId', 'productId', 'quantity', 'status']),
);
const products = defineDatabasePermission((p) =>
  p.collection('products').read(['id', 'name', 'stock']).update(['stock']),
);
export const ownedOrders = defineRecordAccess('orders.owned', (a) =>
  a
    .title('Orders I own')
    .collections('orders')
    .resolver(({ principal }) =>
      principal.type === 'user'
        ? buildFilter((f) => f.string('ownerId').eq(principal.id))
        : false,
    ),
);
export const orderPermissions = defineCompositeResource('orders', (r) =>
  r
    .title('Orders')
    .action('read', (a) => a.title('Read orders').grant('orders', orders))
    .action('confirm', (a) =>
      a
        .title('Confirm orders')
        .grant('orders', orders.update(['status']))
        .grant('products', products),
    ),
);
export class OrderAccessDenied extends Error {}
export function authorizeOrder(
  context: AuthorizationContext,
  action: 'confirm',
): Promise<ConfirmationPolicies>;
export function authorizeOrder(
  context: AuthorizationContext,
  action: 'read',
): Promise<{ orders: RepositoryPolicy }>;
export async function authorizeOrder(
  context: AuthorizationContext,
  action: 'read' | 'confirm',
): Promise<{ orders: RepositoryPolicy; products?: RepositoryPolicy }> {
  const decision = await context.authorize({
    resource: { type: 'composite', id: 'orders' },
    action,
  });
  const policies = decision.conditions?.database;
  if (decision.effect === 'deny' || !policies?.orders) {
    throw new OrderAccessDenied('Order action is not permitted.');
  }
  if (action === 'read') return { orders: policies.orders };
  if (!policies.products)
    throw new OrderAccessDenied('Product access is not permitted.');
  return { orders: policies.orders, products: policies.products };
}
