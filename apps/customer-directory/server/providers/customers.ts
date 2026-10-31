import type { Application } from '@nocobase/app-server/application';
import { ServiceProvider } from '@nocobase/service-provider';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { customerResource } from '../customer-resource.js';
export default class CustomersProvider extends ServiceProvider<Application> {
  readonly name = 'app/customers';
  override async boot(): Promise<void> {
    const authz = this.app.container.resolve(authorizationToken);
    const title = { key: 'customers.title', ns: 'customer-directory' };
    authz.database.collections.add({ name: 'customers', title });
    const reference = authz.compositeResources.define(customerResource);
    authz.ui.sections.add({ name: 'customers', title, parent: 'business' });
    authz.ui.place(reference, { section: 'customers' });
  }
}
