import type { Application } from '@nocobase/app-server/application';
import {
  ServiceProvider,
  createServiceToken,
} from '@nocobase/service-provider';
import { databaseManagerToken } from '@nocobase/db';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { accessResource, ownedRecords, title } from '../access/permissions.js';
import { CustomerAccessService } from './customer-access-service.js';
export const customerAccessToken = createServiceToken<CustomerAccessService>(
  'app/customer-access',
);
export default class CustomerAccessProvider extends ServiceProvider<Application> {
  readonly name = 'app/customer-access';
  override register() {
    this.app.container.singleton(
      customerAccessToken,
      () =>
        new CustomerAccessService(
          this.app.container.resolve(databaseManagerToken).connection(),
        ),
    );
  }
  override async boot() {
    const authz = this.app.container.resolve(authorizationToken);
    authz.database.collections.add({
      name: 'accessCustomers',
      title: title('customers'),
    });
    authz.database.collections.add({
      name: 'accessOrders',
      title: title('orders'),
    });
    authz.recordAccess.define(ownedRecords);
    const resource = authz.compositeResources.define(accessResource);
    authz.ui.sections.add({
      name: 'customer-access',
      title: title('title'),
      parent: 'business',
    });
    authz.ui.place(resource, { section: 'customer-access' });
  }
}
