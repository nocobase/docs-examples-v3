import type { Application } from '@nocobase/app-server/application';
import {
  ServiceProvider,
  createServiceToken,
} from '@nocobase/service-provider';
import { databaseManagerToken } from '@nocobase/db';
import { userAdministrationServiceToken } from '@nocobase/app-plugin-authentication/server';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { CustomerService } from '../customers/service.js';
import {
  customerPermissions,
  assignedCustomers,
  label,
} from '../customers/permissions.js';
export const customerServiceToken =
  createServiceToken<CustomerService>('crm/customers');
export default class CustomersProvider extends ServiceProvider<Application> {
  readonly name = 'crm/customers';
  override async boot() {
    const authz = this.app.container.resolve(authorizationToken);
    authz.database.collections.add({
      name: 'customers',
      title: label('title'),
    });
    authz.recordAccess.define(assignedCustomers);
    authz.ui.sections.add({
      name: 'customers',
      parent: 'business',
      title: label('title'),
    });
    authz.ui.place(authz.compositeResources.define(customerPermissions), {
      section: 'customers',
    });
    this.app.container.instance(
      customerServiceToken,
      new CustomerService(
        this.app.container.resolve(databaseManagerToken),
        this.app.container.resolve(userAdministrationServiceToken),
      ),
    );
  }
}
