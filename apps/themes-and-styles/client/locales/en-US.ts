import fileUi from '../extensions/nocobase-file-component-ui/locales/en-US.js';
import type { LocaleResource } from '@nocobase/i18n';

import systemEnUS from './system/en-US.js';

const enUS = {
  // The template's own copy: the shell, the sign-in pages, shared components and the homepage. Keep it in
  // `./system/` so a template upgrade can replace it without touching the application's copy below.
  ...systemEnUS,
  ...fileUi,
  appearance: {
    ...systemEnUS.appearance,
    themes: { ...systemEnUS.appearance.themes, brand: 'Brand' },
  },
  products: {
    title: 'Product catalog',
    description: 'Explore the catalog in your preferred appearance.',
    reset: 'Reset products',
    name: 'Product',
    sku: 'SKU',
    price: 'Price',
    priceLabel: 'Price (USD)',
    stock: 'Stock',
    availability: 'Availability',
    outOfStock: 'Out of stock',
    lowStock: 'Low stock',
    inStock: 'In stock',
    inventory: 'Inventory',
    editHint: 'Select a product name to edit its details.',
    memoryNotice:
      'Product edits last until you reload the page. Appearance choices are saved in this browser.',
    appliedMode: 'Applied mode: {{mode}}',
    savedAppearance: 'Your choice applies across the application.',
    editTitle: 'Edit product',
    editDescription: 'Update the product name and price for this session.',
    nameRequired: 'Enter a product name.',
    priceInvalid: 'Enter a price of zero or more.',
    notFound: 'Product not found.',
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
