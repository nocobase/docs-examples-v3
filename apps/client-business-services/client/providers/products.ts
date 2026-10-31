import { apiClientToken, type ClientApplication } from '@nocobase/app-client';
import { ServiceProvider } from '@nocobase/service-provider';
import { ProductsService } from '../services/products.js';
import { productsServiceToken } from '../services/tokens.js';
export class ProductsServiceProvider extends ServiceProvider<ClientApplication> {
  readonly name = 'app.products';
  override register(): void {
    this.app.container.singleton(
      productsServiceToken,
      (services) => new ProductsService(services.resolve(apiClientToken)),
    );
  }
  override async shutdown(): Promise<void> {
    this.app.container.resolveIfCreated(productsServiceToken)?.dispose();
  }
}
