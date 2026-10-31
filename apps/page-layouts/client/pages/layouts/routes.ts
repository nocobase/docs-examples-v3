import { Package } from 'lucide-react';
import { defineAppRoutes } from '@nocobase/app-client/plugins';

export const layoutRoutes = defineAppRoutes([
  {
    name: 'layouts',
    path: '/layouts',
    auth: 'required',
    // These read-only fictional fixtures are intentionally available to every signed-in user.
    authz: 'skip',
    navigation: { title: 'layouts.title', icon: Package },
    componentLoader: () => import('./index.js'),
    children: [
      {
        name: 'layoutSummary',
        path: 'dialog/:productId',
        componentLoader: () => import('./summary.js'),
      },
      {
        name: 'layoutDrawer',
        path: 'drawer/:productId',
        componentLoader: () => import('./drawer.js'),
      },
      {
        name: 'layoutDetail',
        path: 'page/:productId',
        componentLoader: () => import('./detail.js'),
        children: [
          {
            name: 'layoutOverview',
            path: 'overview',
            componentLoader: () => import('./overview.js'),
          },
          {
            name: 'layoutHandling',
            path: 'handling',
            componentLoader: () => import('./handling.js'),
          },
        ],
      },
    ],
  },
  {
    name: 'catalogGuide',
    path: '/catalog-guide',
    auth: 'optional',
    authz: 'skip',
    componentLoader: () => import('./guide.js'),
  },
]);
