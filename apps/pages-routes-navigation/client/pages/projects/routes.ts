import { FolderKanban, ChartColumn, ShieldCheck } from 'lucide-react';
import { defineAppRoutes } from '@nocobase/app-client/plugins';

export const projectRoutes = defineAppRoutes([
  {
    name: 'business',
    navigation: { title: 'demo.business', order: 10 },
    children: [
      {
        name: 'projects',
        path: '/projects',
        auth: 'required',
        authz: { resource: { type: 'page', id: 'projects' }, action: 'access' },
        navigation: { title: 'demo.projects', icon: FolderKanban },
        componentLoader: () => import('./index.js'),
        children: [
          {
            name: 'projectCreate',
            path: 'new',
            authz: {
              resource: { type: 'page', id: 'project-drafts' },
              action: 'access',
            },
            componentLoader: () => import('./new.js'),
          },
          {
            name: 'projectWorkspace',
            path: 'workspace/:projectId',
            breadcrumb: { title: 'demo.workspace' },
            componentLoader: () => import('./workspace.js'),
          },
          {
            name: 'projectDetail',
            path: ':projectId',
            componentLoader: () => import('./detail.js'),
            children: [
              {
                name: 'projectTask',
                path: 'tasks/:taskId',
                componentLoader: () => import('./task.js'),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'projectStandalone',
    path: '/project-pages/:projectId',
    authz: { resource: { type: 'page', id: 'projects' }, action: 'access' },
    breadcrumb: { title: 'demo.projectPage' },
    componentLoader: () =>
      import('./workspace.js').then((m) => ({ default: m.ProjectPage })),
  },
  {
    name: 'reportsGroup',
    path: '/reports',
    navigation: { title: 'demo.insights', order: 20 },
    children: [
      {
        name: 'reports',
        path: '/',
        authz: 'skip',
        navigation: { title: 'demo.reports', icon: ChartColumn },
        componentLoader: () => import('../reports/index.js'),
        children: [
          {
            name: 'reportSummary',
            path: 'summary',
            componentLoader: () => import('../reports/summary.js'),
          },
          {
            name: 'reportOwners',
            path: 'owners',
            componentLoader: () => import('../reports/owners.js'),
          },
        ],
      },
    ],
  },
  {
    name: 'adminNotes',
    path: '/admin-notes',
    authz: 'unrestricted',
    navigation: { title: 'demo.adminNotes', icon: ShieldCheck, order: 30 },
    componentLoader: () => import('../examples/admin.js'),
    children: [
      {
        name: 'adminChild',
        path: 'child',
        authz: 'skip',
        componentLoader: () => import('../examples/admin-child.js'),
      },
    ],
  },
  {
    name: 'publicProjects',
    path: '/public-projects',
    auth: 'optional',
    authz: 'skip',
    componentLoader: () => import('../examples/public.js'),
  },
  {
    name: 'welcome',
    path: '/welcome',
    auth: 'guest',
    authz: 'skip',
    componentLoader: () => import('../examples/welcome.js'),
  },
  {
    name: 'slowPage',
    path: '/route-status/loading',
    authz: 'skip',
    componentLoader: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return import('../examples/loaded.js');
    },
  },
  {
    name: 'brokenPage',
    path: '/route-status/error',
    authz: 'skip',
    componentLoader: () => import('../examples/broken.js'),
  },
]);

// Same-package forward reference: client/routes.ts collects this before projectRoutes.
export const appendedRoutes = defineAppRoutes([
  {
    parent: 'reportsGroup',
    name: 'reportExports',
    path: 'exports',
    authz: 'skip',
    navigation: { title: 'demo.exports', order: 10 },
    componentLoader: () => import('../examples/exports.js'),
  },
]);
