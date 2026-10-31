import type { Application } from '@nocobase/app-server/application';
import { databaseManagerToken } from '@nocobase/db';
import {
  ServiceProvider,
  createServiceToken,
} from '@nocobase/service-provider';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { OrderService } from '../orders/service.js';
import { orderPermissions } from '../orders/permissions.js';

export const orderServiceToken = createServiceToken<OrderService>(
  'request-validation/orders',
);
export default class OrdersProvider extends ServiceProvider<Application> {
  readonly name = 'request-validation/orders';
  override register(): void {
    this.app.container.singleton(
      orderServiceToken,
      (container) => new OrderService(container.resolve(databaseManagerToken)),
    );
  }
  override async boot(): Promise<void> {
    const authz = this.app.container.resolve(authorizationToken);
    authz.database.collections.add({ name: 'orders', title: 'Orders' });
    authz.database.collections.add({ name: 'customers', title: 'Customers' });
    authz.compositeResources.define(orderPermissions);
  }
}
