import { describe, expect, it } from 'vitest';
import {
  defineAppRoutes,
  resolveAppClientContributions,
  type AppClientRouteDefinition,
} from '@nocobase/app-client/plugins';
import reporting from '../../client/reporting-plugin.js';
const componentLoader = async () => ({ default: () => null });
function resolve(definitions: AppClientRouteDefinition[]) {
  return resolveAppClientContributions([
    {
      packageName: 'test-app',
      source: 'application',
      routes: defineAppRoutes(definitions),
    },
  ]);
}
describe('documented route constraints', () => {
  it('normalizes slash paths and lets an empty-path child serve a group landing page', () => {
    const { routes } = resolve([
      {
        name: 'group',
        path: '/reports//',
        navigation: { title: 'Reports' },
        children: [
          { name: 'landing', path: '/', authz: 'skip', componentLoader },
          { name: 'owners', path: '/owners/', authz: 'skip', componentLoader },
        ],
      },
    ]);
    expect(routes[0].children?.map((r) => r.path)).toEqual([
      '/reports',
      '/reports/owners',
    ]);
  });
  it.each([
    '/projects/*',
    '/projects/:id?',
    '/projects?q=x',
    '/projects#x',
    '/projects/../x',
    'relative',
  ])('rejects unsupported root path %s', (path) => {
    expect(() => resolve([{ name: 'bad', path, componentLoader }])).toThrow();
  });
  it('rejects duplicate paths even when only case or parameter names differ', () => {
    for (const paths of [
      ['/Projects', '/projects'],
      ['/projects/:id', '/projects/:projectId'],
    ])
      expect(() =>
        resolve(
          paths.map((path, index) => ({
            name: `page${index}`,
            path,
            componentLoader,
          })),
        ),
      ).toThrow(/conflicts/);
  });
  it('rejects a dynamic menu and a child that changes inherited authentication', () => {
    expect(() =>
      resolve([
        {
          name: 'detail',
          path: '/projects/:id',
          navigation: { title: 'Detail' },
          componentLoader,
        },
      ]),
    ).toThrow(/static/);
    expect(() =>
      resolve([
        {
          name: 'parent',
          path: '/projects',
          auth: 'required',
          componentLoader,
          children: [
            { name: 'child', path: 'child', auth: 'optional', componentLoader },
          ],
        },
      ]),
    ).toThrow(/inherited auth/);
  });
  it('rejects missing groups, pages as parents, cycles and parent inside children', () => {
    expect(() =>
      resolve([
        {
          name: 'missing',
          parent: 'unknown',
          path: '/missing',
          componentLoader,
        },
      ]),
    ).toThrow(/missing group/);
    expect(() =>
      resolve([
        { name: 'parent', path: '/p', componentLoader },
        { name: 'child', parent: 'parent', path: 'c', componentLoader },
      ]),
    ).toThrow(/group, not a page/);
    expect(() =>
      resolve([
        { name: 'a', parent: 'b', navigation: { title: 'A' }, children: [] },
        { name: 'b', parent: 'a', navigation: { title: 'B' }, children: [] },
      ]),
    ).toThrow(/Circular/);
    expect(() =>
      resolve([
        {
          name: 'a',
          navigation: { title: 'A' },
          children: [{ name: 'b', parent: 'a', path: 'b', componentLoader }],
        },
      ]),
    ).toThrow(/inside children/);
  });
  it('evaluates plugin options before route resolution', () => {
    expect(
      reporting({ enabled: false }).routes.flatMap((r) => r.routes),
    ).toEqual([]);
    expect(
      reporting({ enabled: true }).routes.flatMap((r) => r.routes),
    ).toHaveLength(1);
  });
});
