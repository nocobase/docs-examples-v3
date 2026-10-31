import { useParams } from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import { products } from './data.js';

export function ProductInfo({ extended = false }: { extended?: boolean }) {
  const { productId } = useParams();
  const { t } = useTranslation();
  const product = products.find((item) => item.id === productId);
  if (!product) return <p role='status'>{t('layouts.missing')}</p>;
  return (
    <div className='flex flex-col gap-6'>
      <dl className='grid gap-4 sm:grid-cols-2'>
        {[
          [t('layouts.product'), product.name],
          [t('layouts.sku'), product.sku],
          [t('layouts.category'), t(`layouts.${product.category}`)],
          [t('layouts.warehouse'), product.warehouse],
        ].map(([label, value]) => (
          <div key={label} className='flex flex-col gap-1'>
            <dt className='text-sm text-muted-foreground'>{label}</dt>
            <dd className='font-medium'>{value}</dd>
          </div>
        ))}
      </dl>
      {extended && (
        <section
          className='flex flex-col gap-4'
          aria-label={t('layouts.handling')}
        >
          <h2 className='text-lg font-semibold'>{t('layouts.handling')}</h2>
          {Array.from({ length: 12 }, (_, index) => (
            <p className='text-sm leading-6' key={index}>
              {t('layouts.handlingNote', { number: index + 1 })}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
