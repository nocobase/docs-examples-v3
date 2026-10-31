import type { Application } from '@nocobase/app-server/application';
import { loggingToken } from '@nocobase/app-server/logging';
import { databaseManagerToken } from '@nocobase/db';
import {
  ServiceProvider,
  createServiceToken,
} from '@nocobase/service-provider';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { DefaultOrderService, type OrderService } from '../orders/service.js';
import { ownedOrders, orderPermissions } from '../orders/permissions.js';

export const orderServiceToken = createServiceToken<OrderService>(
  'order-services/orders',
);
export default class OrdersProvider extends ServiceProvider<Application> {
  readonly name = 'order-services/orders';
  override register(): void {
    this.app.container.singleton(
      orderServiceToken,
      (resolver) =>
        new DefaultOrderService(
          resolver.resolve(databaseManagerToken),
          (order) =>
            resolver
              .resolve(loggingToken)
              .getLogger('orders')
              .info({ orderId: order.id }, 'Order confirmed'),
        ),
    );
  }
  override async boot(): Promise<void> {
    const authz = this.app.container.resolve(authorizationToken);
    authz.database.collections.add({ name: 'orders', title: 'Orders' });
    authz.database.collections.add({ name: 'products', title: 'Products' });
    authz.recordAccess.define(ownedOrders);
    authz.ui.sections.add({
      name: 'orders',
      parent: 'business',
      title: 'Orders',
    });
    authz.ui.place(authz.compositeResources.define(orderPermissions), {
      section: 'orders',
    });
  }
}
