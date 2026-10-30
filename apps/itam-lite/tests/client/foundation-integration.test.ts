import { describe, expect, it } from 'vitest';
import { resolveAppRuntime } from '@nocobase/app-client/runtime';
import appRuntime from '../../client/runtime.js';
import cliPlugins from '../../cli/plugins.js';
import serverPlugins from '../../server/plugins.js';
import { buildRouteNavigation } from '../../client/routing/route-navigation.js';

describe('default Foundation integration', () => {
  it('registers the Foundation deployment evidence build hook', () => {
    expect(
      cliPlugins.plugins.filter(
        (plugin) => plugin.packageName === '@nocobase/app-plugin-foundation',
      ),
    ).toHaveLength(1);
  });
  // ITAM Lite registers System settings (users, roles, workflow management), so Foundation is merged into that group
  // instead of its own `foundationSettings` group of the bare template.
  it('exposes Foundation in System settings for an unrestricted administrator and hides it when denied', async () => {
    const runtime = await resolveAppRuntime(appRuntime);
    const menu = buildRouteNavigation(runtime.routes, new Set());
    expect(menu.some(({ route }) => route.name === 'foundationSettings')).toBe(
      false,
    );
    const settings = menu.find(({ route }) => route.name === 'settings');
    const page = settings?.children.at(-1)?.route;
    expect(page).toMatchObject({
      name: 'foundation',
      path: '/foundation',
      auth: 'required',
      authz: 'unrestricted',
    });
    if (!page) throw new Error('Foundation route missing');
    expect(
      buildRouteNavigation(
        runtime.routes,
        new Set([`${page.packageName}:${page.path}:${page.id}`]),
      )
        .find(({ route }) => route.name === 'settings')
        ?.children.some(({ route }) => route.name === 'foundation'),
    ).toBe(false);
    expect(
      serverPlugins.plugins.filter(
        (plugin) => plugin.packageName === '@nocobase/app-plugin-foundation',
      ),
    ).toHaveLength(1);
  });
});
