import { useState } from 'react';
import { useOutletContext, useParams } from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import { useToaster } from '@nocobase/app-client';
import { RouteDialog } from '#components/route-dialog';
import { useRouteOverlay } from '#components/use-route-overlay';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Label } from '#components/ui/label';
import { Checkbox } from '#components/ui/checkbox';
import type { CatalogContext, Product } from './data.js';

export default function EditProductPage() {
  const { t } = useTranslation();
  const { productId } = useParams();
  const context = useOutletContext<CatalogContext>();
  const product = context.products.find((item) => item.id === productId);
  return (
    <RouteDialog
      title={t('catalog.editTitle')}
      description={t('catalog.editDescription')}
    >
      {product ? (
        <EditForm key={product.id} product={product} save={context.save} />
      ) : (
        <p>{t('catalog.notFound')}</p>
      )}
    </RouteDialog>
  );
}

function EditForm({
  product,
  save,
}: {
  product: Product;
  save: CatalogContext['save'];
}) {
  const { t } = useTranslation();
  const { close } = useRouteOverlay();
  const toaster = useToaster();
  const [name, setName] = useState(product.name);
  const [error, setError] = useState<'required' | 'failed'>();
  const [fail, setFail] = useState(false);
  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError('required');
      return;
    }
    if (fail) {
      setError('failed');
      return;
    }
    save(product.id, name.trim());
    toaster.show({
      type: 'success',
      title: t('catalog.saved', { name: name.trim() }),
    });
    void close();
  }
  return (
    <form className='space-y-5' onSubmit={submit} noValidate>
      <div className='grid gap-2'>
        <Label htmlFor='product-name'>{t('catalog.name')}</Label>
        <Input
          id='product-name'
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(undefined);
          }}
          aria-invalid={error === 'required'}
          aria-describedby={error === 'required' ? 'name-error' : undefined}
        />
        {error === 'required' ? (
          <p id='name-error' role='alert' className='text-sm text-destructive'>
            {t('catalog.required')}
          </p>
        ) : null}
      </div>
      <div className='flex items-center gap-2'>
        <Checkbox
          id='fail-save'
          checked={fail}
          onCheckedChange={(value) => setFail(value === true)}
        />
        <Label htmlFor='fail-save'>{t('catalog.simulateFailure')}</Label>
      </div>
      {error === 'failed' ? (
        <p role='alert' className='text-sm text-destructive'>
          {t('catalog.failed')}
        </p>
      ) : null}
      <div className='flex justify-end gap-2'>
        <Button type='button' variant='outline' onClick={() => void close()}>
          {t('catalog.cancel')}
        </Button>
        <Button type='submit'>{t('catalog.save')}</Button>
      </div>
    </form>
  );
}
