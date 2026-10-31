import { useState } from 'react';
import { Link, Outlet } from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '#components/data-table';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Label } from '#components/ui/label';
import { ProductPageFrame } from './product-page-frame.js';
import { products, type Product } from './data.js';

export default function ProductLayoutsPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [longTitle, setLongTitle] = useState(false);
  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: 'name',
      header: t('layouts.product'),
      cell: ({ row }) => (
        <Link
          className='font-medium text-primary underline-offset-4 hover:underline'
          to={`drawer/${row.original.id}`}
        >
          {row.original.name}
        </Link>
      ),
    },
    { accessorKey: 'sku', header: t('layouts.sku') },
    {
      accessorKey: 'category',
      header: t('layouts.category'),
      cell: ({ row }) => t(`layouts.${row.original.category}`),
    },
    { accessorKey: 'warehouse', header: t('layouts.warehouse') },
    {
      id: 'actions',
      header: t('layouts.views'),
      cell: ({ row }) => (
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            render={<Link to={`dialog/${row.original.id}`} />}
          >
            {t('layouts.summary')}
          </Button>
          <Button
            variant='outline'
            size='sm'
            render={<Link to={`page/${row.original.id}`} />}
          >
            {t('layouts.details')}
          </Button>
        </div>
      ),
    },
  ];
  return (
    <>
      <ProductPageFrame
        title={t(longTitle ? 'layouts.longTitle' : 'layouts.title')}
        description={t('layouts.description')}
        actions={
          <Button variant='outline' onClick={() => setLongTitle(!longTitle)}>
            {t(longTitle ? 'layouts.shortHeading' : 'layouts.longHeading')}
          </Button>
        }
        filterLabel={t('layouts.filters')}
        filters={
          <>
            <Label htmlFor='product-search'>{t('layouts.search')}</Label>
            <Input
              id='product-search'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('layouts.searchPlaceholder')}
            />
            <p className='text-sm text-muted-foreground'>
              {t('layouts.filterHelp')}
            </p>
            <Button variant='outline' onClick={() => setQuery('')}>
              {t('layouts.clear')}
            </Button>
          </>
        }
      >
        <DataTable
          columns={columns}
          data={products.filter((product) =>
            product.name.toLowerCase().includes(query.toLowerCase()),
          )}
          pagination={false}
          emptyMessage={t('layouts.empty')}
        />
      </ProductPageFrame>
      {/* Keep the outlet beside the parent container so RouteChildPage covers and inerts it. */}
      <Outlet />
    </>
  );
}
