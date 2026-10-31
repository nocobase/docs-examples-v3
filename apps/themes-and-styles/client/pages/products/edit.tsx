import { useTranslation } from '@nocobase/i18n/client';
import { useRef, useState, type ReactElement } from 'react';
import { useOutletContext, useParams } from 'react-router';
import { RouteDialog } from '#components/route-dialog';
import { useRouteOverlay } from '#components/use-route-overlay';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Label } from '#components/ui/label';
import type { Product, ProductsContext } from './data.js';

function CancelButton(): ReactElement {
  const { t } = useTranslation();
  const { close } = useRouteOverlay();
  return (
    <Button variant='outline' onClick={() => void close()}>
      {t('actions.cancel')}
    </Button>
  );
}

function ProductForm({
  product,
  onSave,
}: {
  product: Product;
  onSave: (product: Product) => void;
}): ReactElement {
  const { t } = useTranslation();
  const { close } = useRouteOverlay();
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  return (
    <form
      id='product-edit'
      noValidate
      className='flex flex-col gap-5'
      onSubmit={(event) => {
        event.preventDefault();
        const nextErrors = {
          ...(!name.trim() ? { name: t('products.nameRequired') } : {}),
          ...(price.trim() === '' ||
          !Number.isFinite(Number(price)) ||
          Number(price) < 0
            ? { price: t('products.priceInvalid') }
            : {}),
        };
        setErrors(nextErrors);
        if (nextErrors.name) {
          nameRef.current?.focus();
          return;
        }
        if (nextErrors.price) {
          priceRef.current?.focus();
          return;
        }
        onSave({ ...product, name: name.trim(), price: Number(price) });
        void close();
      }}
    >
      <div className='flex flex-col gap-2'>
        <Label htmlFor='product-name'>{t('products.name')}</Label>
        <Input
          ref={nameRef}
          id='product-name'
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'product-name-error' : undefined}
        />
        {errors.name ? (
          <p
            id='product-name-error'
            role='alert'
            className='text-sm text-destructive'
          >
            {errors.name}
          </p>
        ) : null}
      </div>
      <div className='flex flex-col gap-2'>
        <Label htmlFor='product-price'>{t('products.priceLabel')}</Label>
        <Input
          ref={priceRef}
          id='product-price'
          type='number'
          min='0'
          step='0.01'
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          aria-invalid={!!errors.price}
          aria-describedby={errors.price ? 'product-price-error' : undefined}
        />
        {errors.price ? (
          <p
            id='product-price-error'
            role='alert'
            className='text-sm text-destructive'
          >
            {errors.price}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export default function EditProductPage(): ReactElement {
  const { t } = useTranslation();
  const { productId } = useParams();
  const { products, saveProduct } = useOutletContext<ProductsContext>();
  const product = products.find((item) => item.id === productId);
  return (
    <RouteDialog
      title={t('products.editTitle')}
      description={t('products.editDescription')}
      className='sm:max-w-md'
      footer={
        <>
          <CancelButton />
          {product ? (
            <Button type='submit' form='product-edit'>
              {t('actions.save')}
            </Button>
          ) : null}
        </>
      }
    >
      {product ? (
        <ProductForm key={product.id} product={product} onSave={saveProduct} />
      ) : (
        <p>{t('products.notFound')}</p>
      )}
    </RouteDialog>
  );
}
