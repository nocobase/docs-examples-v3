import fileUi from '../extensions/nocobase-file-component-ui/locales/en-US.js';
import type { LocaleResource } from '@nocobase/i18n';

import systemEnUS from './system/en-US.js';

const enUS = {
  catalog: {
    title: 'Product Catalog',
    heading: 'Find your next everyday essential',
    description:
      'Browse published products from our catalog. Prices are shown in USD.',
    product: 'Product',
    price: 'Price (USD)',
    app: 'Application',
    docs: 'API documentation',
    download: 'Download CSV',
    downloadHint:
      'CSV downloads include the products your account can view, including drafts. Sign in with catalog view permission first.',
    limit:
      'Showing up to 50 published products. Downloads include up to 500 permitted records.',
    empty: 'No published products yet.',
    view: 'View products',
    create: 'Create products',
    publish: 'Publish products',
    viewer: 'Catalog viewer',
    editor: 'Catalog editor',
  },
  // The template's own copy: the shell, the sign-in pages, shared components and the homepage. Keep it in
  // `./system/` so a template upgrade can replace it without touching the application's copy below.
  ...systemEnUS,
  ...fileUi,
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
