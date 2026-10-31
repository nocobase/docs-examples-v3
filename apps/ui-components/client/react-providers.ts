import { CatalogDemoProvider } from './pages/ui-components/demo-provider.js';
import { CatalogApprovalProvider } from './pages/ui-components/approval-provider.js';
import {
  defineClientReactProviders,
  type AppClientReactProviderDefinition,
} from '@nocobase/app-client/plugins';

import { Toaster } from '#components/ui/toast';

import { AppThemeProvider } from './theme/theme-provider.js';

export const reactProviders: readonly AppClientReactProviderDefinition[] =
  defineClientReactProviders([
    {
      name: 'catalog-demo',
      layer: 'application',
      component: CatalogDemoProvider,
    },
    {
      name: 'catalog-approval-ui',
      layer: 'application',
      component: CatalogApprovalProvider,
    },
    {
      component: AppThemeProvider,
      layer: 'root',
      name: 'theme',
    },
    // The one toast host. It renders what plugins and pages report through
    // `useToaster()`, which `client/service-provider.ts` connects to it.
    // Pages must not mount another.
    {
      component: Toaster,
      layer: 'application',
      name: 'toaster',
    },
  ]);

export default reactProviders;
