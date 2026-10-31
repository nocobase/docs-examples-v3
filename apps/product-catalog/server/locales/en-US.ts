import type { LocaleResource } from '@nocobase/i18n';
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
};
export type AppServerResource = LocaleResource<typeof enUS>;
export default enUS;
