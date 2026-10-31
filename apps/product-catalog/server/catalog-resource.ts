import { defineCompositeResource } from '@nocobase/authorization/core';
import { defineDatabasePermission } from '@nocobase/app-plugin-authorization/server';
const title = (key: string) => ({
  key: `catalog.${key}`,
  ns: 'product-catalog',
});
const productData = defineDatabasePermission((p) =>
  p
    .collection('catalogProducts')
    .read(['id', 'name', 'priceCents', 'published']),
);
export const catalogResource = defineCompositeResource('catalog', (r) =>
  r
    .title(title('title'))
    .action('view', (a) =>
      a.title(title('view')).grant('products', productData),
    )
    .action('create', (a) =>
      a
        .title(title('create'))
        .grant(
          'products',
          productData.create(['id', 'name', 'priceCents', 'published']),
        ),
    )
    .action('publish', (a) =>
      a
        .title(title('publish'))
        .grant('products', productData.update(['published'])),
    ),
);
