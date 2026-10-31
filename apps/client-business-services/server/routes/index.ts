import type { Application } from '@nocobase/app-server/application';
import type { AppRouteContribution } from '@nocobase/app-server/router';

import demoProducts from './demo-products.js';

const routes: readonly AppRouteContribution<Application>[] = [demoProducts];

export default routes;
