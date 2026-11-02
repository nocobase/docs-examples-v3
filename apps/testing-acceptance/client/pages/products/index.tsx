import { useHref } from 'react-router';
import { useApiClient, useSubmission } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import { useState } from 'react';
import { useListData } from '#hooks/use-list-data';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '#components/data-table';
import { Button } from '#components/ui/button';
import { Badge } from '#components/ui/badge';
import { ProductForm } from './form.js';

type Product = {
  id: string;
  name: string;
  priceCents: number;
  published: boolean;
};
type Access = { view: boolean; create: boolean; publish: boolean };
export default function ProductsPage() {
  const publicUrl = useHref('/catalog');
  const exportUrl = useHref('/catalog/export.csv');
  const api = useApiClient();
  const { t } = useTranslation();
  const submission = useSubmission({ scope: 'products:publish' });
  const permissions = useListData<{ data: Access }>('catalogAccess');
  const access = permissions.data?.data;
  const products = useListData<{ data: Product[] }>('products?pageSize=50', {
    active: access?.view === true,
  });
  const data = products.data?.data ?? [];
  const loading =
    permissions.loading || (access?.view === true && products.loading);
  const failed = Boolean(permissions.error || products.error);
  const [publishFailed, setPublishFailed] = useState(false);
  const load = () => {
    permissions.reload();
    products.reload();
  };
  async function publish(id: string) {
    setPublishFailed(false);
    try {
      await submission.run({ id }, (key) =>
        api.request({
          path: `products/${id}/publish`,
          method: 'POST',
          headers: { 'Idempotency-Key': key },
          json: {},
        }),
      );
      load();
    } catch {
      setPublishFailed(true);
    }
  }
  const columns: ColumnDef<Product>[] = [
    { accessorKey: 'name', header: t('products.name') },
    { accessorKey: 'priceCents', header: t('products.price') },
    {
      accessorKey: 'published',
      header: t('products.status'),
      cell: ({ row }) => (
        <Badge variant='secondary'>
          {t(row.original.published ? 'products.published' : 'products.draft')}
        </Badge>
      ),
    },
    ...(access?.publish
      ? [
          {
            id: 'actions',
            header: t('products.actions'),
            cell: ({ row }: { row: { original: Product } }) =>
              !row.original.published && (
                <Button
                  variant='outline'
                  size='sm'
                  disabled={submission.submitting}
                  onClick={() => {
                    void publish(row.original.id);
                  }}
                >
                  {t('products.publish')}
                </Button>
              ),
          },
        ]
      : []),
  ];
  return (
    <main className='mx-auto flex w-full max-w-6xl flex-col gap-6 p-6'>
      <header className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-semibold'>{t('products.title')}</h1>
          <p className='mt-2 text-sm text-muted-foreground'>
            {t('products.description')}
          </p>
        </div>
        <Button
          variant='outline'
          disabled={loading}
          onClick={() => {
            void load();
          }}
        >
          {t('products.refresh')}
        </Button>
      </header>
      <nav className='flex gap-4 text-sm'>
        <a className='underline underline-offset-4' href={publicUrl}>
          {t('products.publicCatalog')}
        </a>
        {access?.view && (
          <a className='underline underline-offset-4' href={exportUrl}>
            {t('products.export')}
          </a>
        )}
      </nav>
      {loading && <p role='status'>{t('products.loading')}</p>}
      {failed ? (
        <div role='alert'>
          <p>{t('products.loadFailed')}</p>
          <Button
            variant='outline'
            onClick={() => {
              void load();
            }}
          >
            {t('products.retry')}
          </Button>
        </div>
      ) : access && !access.view ? (
        <p role='alert'>{t('products.denied')}</p>
      ) : (
        access && (
          <>
            {!access.create && (
              <p className='text-sm text-muted-foreground'>
                {t('products.readOnly')}
              </p>
            )}
            {publishFailed && (
              <p role='alert' className='text-destructive'>
                {t('products.publishFailed')}
              </p>
            )}
            <div className='grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]'>
              <div className='min-w-0'>
                <DataTable
                  columns={columns}
                  data={data}
                  pagination={false}
                  emptyMessage={t('products.empty')}
                />
              </div>
              {access.create && (
                <ProductForm
                  onCreated={() => {
                    void load();
                  }}
                />
              )}
            </div>
          </>
        )
      )}
    </main>
  );
}
