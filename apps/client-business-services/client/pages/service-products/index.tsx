import { useState } from 'react';
import { useTranslation } from '@nocobase/i18n/client';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { DataTable } from '#components/data-table';
import { Button } from '#components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '#components/ui/card';
import { useProducts } from '../../hooks/use-products.js';
import { useProductRevision } from '../../hooks/use-product-revision.js';
import type { Product } from '../../services/products.js';
import { ProductEditor } from './editor.js';

function ChangeCounter({ title }: { title: string }) {
  const { t } = useTranslation();
  const count = useProductRevision();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p role='status'>{t('serviceProducts.count', { count })}</p>
      </CardContent>
    </Card>
  );
}
export default function ProductsPage() {
  const { t } = useTranslation();
  const { rows, loading, failed, reload } = useProducts();
  const [selected, setSelected] = useState<Product | null>(null);
  const [showSecond, setShowSecond] = useState(true);
  return (
    <PageContainer>
      <PageHeader
        title={t('serviceProducts.title')}
        description={t('serviceProducts.description')}
        actions={
          <Button variant='outline' onClick={reload} disabled={loading}>
            {t('serviceProducts.refresh')}
          </Button>
        }
      />
      <div className='grid gap-4 md:grid-cols-2'>
        <ChangeCounter title={t('serviceProducts.primary')} />
        {showSecond && <ChangeCounter title={t('serviceProducts.secondary')} />}
      </div>
      <Button variant='outline' onClick={() => setShowSecond(!showSecond)}>
        {t(showSecond ? 'serviceProducts.hide' : 'serviceProducts.show')}
      </Button>
      <div className='grid items-start gap-6 lg:grid-cols-2'>
        <section aria-label={t('serviceProducts.catalog')} className='min-w-0'>
          {failed ? (
            <p role='alert'>{t('serviceProducts.loadFailed')}</p>
          ) : (
            <DataTable<Product>
              data={rows}
              loading={loading}
              pagination={false}
              columns={[
                { accessorKey: 'sku', header: t('serviceProducts.sku') },
                { accessorKey: 'name', header: t('serviceProducts.name') },
                {
                  id: 'edit',
                  header: '',
                  cell: ({ row }) => (
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setSelected({ ...row.original })}
                      aria-label={`${t('serviceProducts.edit')} ${row.original.name}`}
                    >
                      {t('serviceProducts.edit')}
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </section>
        <Card>
          <CardHeader>
            <CardTitle>{t('serviceProducts.editor')}</CardTitle>
          </CardHeader>
          <CardContent>
            {selected ? (
              <ProductEditor key={selected.id} product={selected} />
            ) : (
              <p className='text-sm text-muted-foreground'>
                {t('serviceProducts.select')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <p className='text-sm text-muted-foreground'>
        {t('serviceProducts.scope')}
      </p>
    </PageContainer>
  );
}
