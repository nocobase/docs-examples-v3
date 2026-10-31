import { useTranslation } from '@nocobase/i18n/client';
import type { ColumnDef } from '@tanstack/react-table';
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { Outlet } from 'react-router';
import { DataTable } from '#components/data-table';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { RecordLink } from '#components/record-link';
import { StatusBadge } from '#components/status-badge';
import { Button } from '#components/ui/button';
import { ColorModeControls, PresetControls } from './appearance-controls.js';
import { initialProducts, type Product, type ProductsContext } from './data.js';

export default function ProductsPage(): ReactElement {
  const { t, i18n } = useTranslation();
  const [products, setProducts] = useState<readonly Product[]>(initialProducts);
  const saveProduct = useCallback((product: Product) => {
    setProducts((current) =>
      current.map((item) => (item.id === product.id ? product : item)),
    );
  }, []);
  const context = useMemo<ProductsContext>(
    () => ({ products, saveProduct }),
    [products, saveProduct],
  );
  const currency = new Intl.NumberFormat(i18n.language, {
    style: 'currency',
    currency: 'USD',
  });
  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: 'name',
      header: t('products.name'),
      cell: ({ row }) => (
        <RecordLink to={`edit/${row.original.id}`}>
          {row.original.name}
        </RecordLink>
      ),
    },
    {
      accessorKey: 'sku',
      header: t('products.sku'),
      cell: ({ row }) => (
        <code className='text-sm text-muted-foreground'>
          {row.original.sku}
        </code>
      ),
    },
    {
      accessorKey: 'price',
      header: t('products.price'),
      cell: ({ row }) => currency.format(row.original.price),
    },
    { accessorKey: 'stock', header: t('products.stock') },
    {
      id: 'availability',
      header: t('products.availability'),
      cell: ({ row }) => {
        const stock = row.original.stock;
        return (
          <StatusBadge
            tone={stock === 0 ? 'neutral' : stock < 10 ? 'warning' : 'success'}
          >
            {t(
              stock === 0
                ? 'products.outOfStock'
                : stock < 10
                  ? 'products.lowStock'
                  : 'products.inStock',
            )}
          </StatusBadge>
        );
      },
    },
  ];
  return (
    <PageContainer className='mx-auto max-w-6xl pt-20 md:pt-20'>
      <PageHeader
        title={t('products.title')}
        description={t('products.description')}
        actions={
          <Button
            variant='outline'
            onClick={() => setProducts(initialProducts)}
          >
            {t('products.reset')}
          </Button>
        }
      />
      <section
        className='grid gap-6 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm sm:grid-cols-2'
        aria-label={t('appearance.title')}
        data-testid='appearance-panel'
      >
        <ColorModeControls />
        <PresetControls />
      </section>
      <section className='overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm'>
        <div className='flex flex-col gap-2 border-b border-border p-6'>
          <h2 className='font-heading text-lg font-semibold'>
            {t('products.inventory')}
          </h2>
          <p className='text-sm text-muted-foreground'>
            {t('products.editHint')}
          </p>
        </div>
        <DataTable
          columns={columns}
          data={products}
          pagination={false}
          getRowId={(product) => product.id}
        />
      </section>
      <p className='text-sm text-muted-foreground'>
        {t('products.memoryNotice')}
      </p>
      <Outlet context={context} />
    </PageContainer>
  );
}
