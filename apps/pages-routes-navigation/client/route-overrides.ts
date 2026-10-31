import { defineClientRouteComponentOverrides } from '@nocobase/app-client/plugins';
export default defineClientRouteComponentOverrides([
  {
    routeId: '@example/project-reporting:snapshot',
    componentEntry: './client/pages/examples/plugin-custom',
    componentLoader: () => import('./pages/examples/plugin-custom.js'),
  },
]);
