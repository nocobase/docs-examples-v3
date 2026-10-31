import {
  resolveAppClientContributions,
  applyClientRouteComponentOverrides,
  type AppClientRegisteredRoute,
} from '@nocobase/app-client/plugins';
import appRoutes from '../../client/routes.js';
import reportingPlugin from '../../client/reporting-plugin.js';
import overrides from '../../client/route-overrides.js';
export function resolveDemoRoutes() {
  const plugin = reportingPlugin({ enabled: true });
  const { routes } = resolveAppClientContributions([
    {
      packageName: 'pages-routes-navigation',
      source: 'application',
      routes: appRoutes,
    },
    {
      packageName: plugin.packageName,
      source: 'plugin',
      routes: plugin.routes,
    },
  ]);
  return applyClientRouteComponentOverrides(routes, overrides);
}
export function flatten(
  routes: readonly AppClientRegisteredRoute[],
): AppClientRegisteredRoute[] {
  return routes.flatMap((route) => [route, ...flatten(route.children ?? [])]);
}
