import fileUi from '../extensions/nocobase-file-component-ui/locales/en-US.js';
import type { LocaleResource } from '@nocobase/i18n';

import systemEnUS from './system/en-US.js';

const enUS = {
  // The template's own copy: the shell, the sign-in pages, shared components and the homepage. Keep it in
  // `./system/` so a template upgrade can replace it without touching the application's copy below.
  ...systemEnUS,
  ...fileUi,
  layouts: {
    brand: 'Northstar Supply',
    title: 'Product catalog',
    longTitle:
      'Product catalog for regional distribution and seasonal replenishment planning',
    description: 'Browse sample products and compare their page layouts.',
    product: 'Product',
    sku: 'SKU',
    category: 'Category',
    warehouse: 'Warehouse',
    views: 'Views',
    lighting: 'Lighting',
    furniture: 'Furniture',
    summary: 'Summary',
    details: 'Details',
    longHeading: 'Long heading',
    shortHeading: 'Short heading',
    filters: 'Product filters',
    search: 'Search products',
    searchPlaceholder: 'Search by product name',
    filterHelp:
      'Filters stay in memory while a child view is open. Reload to reset.',
    clear: 'Clear search',
    empty: 'No matching products.',
    missing: 'This sample product does not exist.',
    handling: 'Handling notes',
    handlingNote:
      'Handling note {{number}}: keep this product in its original packaging. Inspect the outer carton before dispatch and store it on a dry, level shelf.',
    done: 'Done',
    summaryTitle: 'Product summary',
    drawerTitle: 'Product details',
    readOnly: 'Fictional product data for this layout example.',
    back: 'Back to catalog',
    detailDescription:
      'The application navigation remains available while this page covers the catalog.',
    detailSections: 'Product sections',
    overview: 'Overview',
    guide: 'Catalog guide',
    guideDescription: 'A standalone page without the application sidebar.',
    guideBody:
      'Browse the product catalog after signing in. Product names, warehouses and handling notes are fictional; this example makes no inventory changes.',
    openCatalog: 'Open product catalog',
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
