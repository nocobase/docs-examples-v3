import fileUi from '../extensions/nocobase-file-component-ui/locales/en-US.js';
import systemEnUS from './system/en-US.js';
import type { LocaleResource } from '@nocobase/i18n';

const enUS = {
  ...systemEnUS,
  ...fileUi,
  navigation: { ...systemEnUS.navigation, catalog: 'Product catalog' },
  catalog: {
    title: 'Product catalog',
    description:
      'Sample products. Edits stay in this browser tab and reset on reload.',
    search: 'Search products',
    empty: 'No matching products.',
    count_one: '{{count}} product',
    count_other: '{{count}} products',
    name: 'Product name',
    price: 'Price (USD)',
    stock: 'Stock',
    updated: 'Updated',
    edit: 'Edit',
    editTitle: 'Edit product',
    editDescription:
      'Change the sample name, then save to see a translated confirmation.',
    required: 'Enter a product name.',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved “{{name}}”.',
    simulateFailure: 'Simulate save failure',
    failed:
      'The simulated save failed. Your changes are still here; turn off the failure and retry.',
    notFound: 'This sample product does not exist.',
    shipping: 'Ships within two business days.',
    language: 'Language',
    examples: 'Translation examples',
    fallbackTitle: 'Missing translation',
    fallbackHelp:
      'The shipping note is intentionally absent in Japanese. It falls back to the configured default language.',
    pluginTitle: 'Plugin wording',
    pluginHelp:
      'This label comes from the i18n plugin namespace, with an application override.',
    currentLocale: 'Current language: {{locale}}',
    cancel: 'Cancel',
  },
  overrides: {
    '@nocobase/app-plugin-i18n': { language: { label: 'Store language' } },
  },
};
export type AppResource = LocaleResource<typeof enUS>;
export default enUS;
