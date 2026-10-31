import { createServiceToken } from '@nocobase/service-provider';
import type { ProductsService } from './products.js';
export const productsServiceToken =
  createServiceToken<ProductsService>('app.products');
