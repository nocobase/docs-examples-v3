import { describe, expect, it } from 'vitest';
import { resolveDemoRoutes, flatten } from './routing-fixture.js';
import CustomSnapshot from '../../client/pages/examples/plugin-custom.js';
import { selectedNavigationId } from '../../client/routing/route-navigation.js';
const routes = resolveDemoRoutes();
const pages = flatten(routes).filter((route) => route.componentLoader);
describe('routing example registration', () => {
  it('retains authentication, home, inbox and real user/role management', () => {
    expect(pages.map((route) => route.path)).toEqual(
      expect.arrayContaining([
        '/',
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password',
        '/device',
        '/inbox',
        '/settings/users',
        '/settings/roles',
      ]),
    );
    expect(
      pages.find((route) => route.name === 'inbox')?.navigation,
    ).toBeUndefined();
  });
  it('loads every registered component, including the intentional render-error module', async () => {
    expect(pages.length).toBeGreaterThan(20);
    for (const page of pages)
      await expect(page.componentLoader!()).resolves.toMatchObject({
        default: expect.any(Function),
      });
  });
  it('pins business page grants and preserves inheritance and explicit skip', () => {
    const names = [
      'projects',
      'projectCreate',
      'projectWorkspace',
      'projectDetail',
      'projectTask',
      'adminNotes',
      'adminChild',
      'projectStandalone',
    ];
    expect(
      names.map((name) => [name, pages.find((p) => p.name === name)?.authz]),
    ).toEqual([
      [
        'projects',
        { resource: { type: 'page', id: 'projects' }, action: 'access' },
      ],
      [
        'projectCreate',
        { resource: { type: 'page', id: 'project-drafts' }, action: 'access' },
      ],
      [
        'projectWorkspace',
        { resource: { type: 'page', id: 'projects' }, action: 'access' },
      ],
      [
        'projectDetail',
        { resource: { type: 'page', id: 'projects' }, action: 'access' },
      ],
      [
        'projectTask',
        { resource: { type: 'page', id: 'projects' }, action: 'access' },
      ],
      ['adminNotes', 'unrestricted'],
      ['adminChild', 'skip'],
      [
        'projectStandalone',
        { resource: { type: 'page', id: 'projects' }, action: 'access' },
      ],
    ]);
  });
  it('attaches same-package and cross-package contributions and applies the override', async () => {
    const snapshot = pages.find((p) => p.name === 'snapshot')!;
    expect(snapshot.path).toBe('/reports/snapshot');
    expect(snapshot.packageName).toBe('@example/project-reporting');
    expect(snapshot.authz).toBe('skip');
    expect((await snapshot.componentLoader!()).default).toBe(CustomSnapshot);
    expect(pages.find((p) => p.name === 'reportExports')?.path).toBe(
      '/reports/exports',
    );
  });
  it('selects the project menu for deep overlays', () => {
    expect(selectedNavigationId(routes, '/projects/p100/tasks/t200')).toContain(
      ':projects',
    );
  });
});
