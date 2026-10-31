import type { Application } from '@nocobase/app-server/application';
import {
  ServiceProvider,
  createServiceToken,
} from '@nocobase/service-provider';
import { databaseManagerToken } from '@nocobase/db';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { CatalogService } from './catalog-service.js';
import { catalogResource } from '../catalog-resource.js';
export const catalogServiceToken =
  createServiceToken<CatalogService>('app/catalog');
export default class CatalogProvider extends ServiceProvider<Application> {
  readonly name = 'app/catalog';
  override register() {
    this.app.container.singleton(
      catalogServiceToken,
      () =>
        new CatalogService(
          this.app.container.resolve(databaseManagerToken).connection(),
        ),
    );
  }
  override async boot() {
    const authz = this.app.container.resolve(authorizationToken);
    const title = { key: 'catalog.title', ns: 'product-catalog' };
    authz.database.collections.add({ name: 'catalogProducts', title });
    const resource = authz.compositeResources.define(catalogResource);
    authz.ui.sections.add({ name: 'catalog', title, parent: 'business' });
    authz.ui.place(resource, { section: 'catalog' });
  }
}
