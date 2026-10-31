import {
  defineAppRoutes,
  defineClientPlugin,
} from '@nocobase/app-client/plugins';

import en from './locales/routing-en-US.js';
import zh from './locales/routing-zh-CN.js';

// A client-only contribution factory kept in this app to demonstrate the plugin API.
// Its packageName is a namespace/route ID, not an npm installation instruction.
export default defineClientPlugin<{ enabled?: boolean }>({
  packageName: '@example/project-reporting',
  locales: {
    'en-US': async () => ({ default: { demo: en } }),
    'zh-CN': async () => ({ default: { demo: zh } }),
  },
  routes: (options) =>
    defineAppRoutes(
      options.enabled === false
        ? []
        : [
            {
              parent: 'pages-routes-navigation:reportsGroup',
              name: 'snapshot',
              path: 'snapshot',
              authz: 'skip',
              navigation: { title: 'demo.snapshot', order: 20 },
              componentLoader: () =>
                import('./pages/examples/plugin-original.js'),
            },
          ],
    ),
});
