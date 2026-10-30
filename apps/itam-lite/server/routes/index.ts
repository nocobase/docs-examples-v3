import type { Application } from '@nocobase/app-server/application';
import type { AppRouteContribution } from '@nocobase/app-server/router';
import { deviceRoutes } from './devices.js';
import { requestRoutes } from './requests.js';
import { workflowRoutes } from './workflows.js';

const routes: readonly AppRouteContribution<Application>[] = [
  deviceRoutes,
  requestRoutes,
  workflowRoutes,
];

export default routes;
