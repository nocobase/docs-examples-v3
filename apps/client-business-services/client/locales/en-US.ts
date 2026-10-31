import fileUi from '../extensions/nocobase-file-component-ui/locales/en-US.js';
import type { LocaleResource } from '@nocobase/i18n';

import systemEnUS from './system/en-US.js';

const enUS = {
  // The template's own copy: the shell, the sign-in pages, shared components and the homepage. Keep it in
  // `./system/` so a template upgrade can replace it without touching the application's copy below.
  ...systemEnUS,
  ...fileUi,
  serviceProducts: {
    title: 'Product catalog',
    description:
      'Edit a product and watch the list and both change counters update.',
    catalog: 'Products',
    name: 'Product name',
    sku: 'SKU',
    edit: 'Edit',
    editor: 'Edit product',
    select: 'Choose a product to edit.',
    save: 'Save changes',
    saving: 'Saving…',
    cancel: 'Cancel request',
    saved: 'Product saved.',
    failed: 'Could not save. Your draft has been kept.',
    cancelled:
      'Request cancelled. Refresh the list to check whether the server saved the change.',
    required: 'Enter a product name (1–80 characters).',
    refresh: 'Refresh list',
    loadFailed: 'Could not load products. Use Refresh list to retry.',
    mode: 'Response mode',
    normal: 'Normal',
    slow: 'Slow (3 seconds)',
    fail: 'Fail',
    primary: 'Catalog changes',
    secondary: 'Second view',
    count: 'Successful changes: {{count}}',
    hide: 'Hide second view',
    show: 'Show second view',
    scope:
      'Counters track successful responses in this browser app. Product edits survive a page refresh but reset when the server restarts.',
    slowHint:
      'Slow mode saves immediately and delays the response. Cancel stops waiting; it does not undo the save.',
  },
  // The application's copy goes here, one group per feature. A shared group such as `navigation` is extended by
  // spreading the system one first, `navigation: { ...systemEnUS.navigation, orders: 'Orders' }`, since a group
  // written here replaces the system group of the same name rather than merging with it.
};

/**
 * The shape every locale of this application follows, derived from the English wording above.
 *
 * Anything a plugin does not translate falls back to this namespace, so a term defined here is reused everywhere
 * without each plugin repeating it.
 */
export type AppResource = LocaleResource<typeof enUS>;

export default enUS;
