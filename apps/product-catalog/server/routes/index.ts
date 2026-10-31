import type { Application } from '@nocobase/app-server/application';
import type { AppRouteContribution } from '@nocobase/app-server/router';

import catalogWeb from './catalog-web.js';
import products from './products.js';
import categories from './categories.js';

const routes: readonly AppRouteContribution<Application>[] = [
  catalogWeb,
  products,
  categories,
];

export default routes;
