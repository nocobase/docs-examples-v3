import { ClipboardList, Home, Inbox, Laptop } from 'lucide-react';
import systemSettingsRoutes from './pages/settings/routes.js';
import {
  defineAppRoutes,
  type AppClientRouteContribution,
} from '@nocobase/app-client/plugins';

const appRoutes: AppClientRouteContribution = defineAppRoutes([
  {
    name: 'devices',
    path: '/devices',
    auth: 'required',
    authz: { resource: { type: 'page', id: 'devices' }, action: 'access' },
    navigation: { title: 'devices.title', icon: Laptop, order: 10 },
    componentLoader: () => import('./pages/devices/index.js'),
    children: [
      {
        name: 'deviceCreate',
        path: 'new',
        componentLoader: () => import('./pages/devices/form.js'),
      },
      {
        name: 'deviceEdit',
        path: 'edit/:deviceId',
        componentLoader: () => import('./pages/devices/form.js'),
      },
    ],
  },
  {
    name: 'requests',
    path: '/requests',
    auth: 'required',
    authz: { resource: { type: 'page', id: 'requests' }, action: 'access' },
    navigation: { title: 'requests.title', icon: ClipboardList, order: 20 },
    componentLoader: () => import('./pages/requests/index.js'),
    children: [
      {
        name: 'requestCreate',
        path: 'new',
        componentLoader: () => import('./pages/requests/new.js'),
      },
      {
        name: 'requestDetail',
        path: ':requestId',
        componentLoader: () => import('./pages/requests/detail.js'),
      },
    ],
  },
  {
    // Every signed-in user reaches the landing page. `authz: 'skip'` takes it out of page authorization entirely, so
    // no permission change can leave a user signed in with nowhere to land.
    authz: 'skip',
    auth: 'required',
    componentLoader: () => import('./pages/home/index.js'),
    name: 'home',
    navigation: { title: 'navigation.home', icon: Home },
    path: '/',
  },
  {
    // The plugin's API answers each person's own messages only, so the page needs no authorization of its own.
    authz: 'skip',
    auth: 'required',
    componentLoader: () => import('./pages/inbox.js'),
    name: 'inbox',
    // ITAM Lite sends approval and issue messages to the inbox, so it gets a sidebar entry after the business pages.
    navigation: { title: 'inboxButton.title', icon: Inbox, order: 30 },
    path: '/inbox',
  },
  {
    auth: 'guest',
    authz: 'skip',
    componentLoader: () => import('./pages/auth/login.js'),
    name: 'login',
    path: '/login',
  },
  {
    auth: 'guest',
    authz: 'skip',
    componentLoader: () => import('./pages/auth/register.js'),
    name: 'register',
    path: '/register',
  },
  {
    auth: 'guest',
    authz: 'skip',
    componentLoader: () => import('./pages/auth/forgot-password.js'),
    name: 'forgot-password',
    path: '/forgot-password',
  },
  {
    auth: 'guest',
    authz: 'skip',
    componentLoader: () => import('./pages/auth/reset-password.js'),
    name: 'reset-password',
    path: '/reset-password',
  },
  {
    // Where a command line's sign-in sends the person to approve it (`pages/auth/device.tsx`). Optional rather than
    // required so it renders outside the shell, like the sign-in pages; the page sends a guest to sign in and back.
    auth: 'optional',
    authz: 'skip',
    componentLoader: () => import('./pages/auth/device.js'),
    name: 'device',
    path: '/device',
  },
]);

const routes: readonly AppClientRouteContribution[] = [
  appRoutes,
  systemSettingsRoutes,
];

export default routes;
