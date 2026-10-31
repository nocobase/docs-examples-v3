import { useTranslation } from '@nocobase/i18n/client';
import { RouteDialog } from '#components/route-dialog';
import { Button } from '#components/ui/button';
import { useRouteOverlay } from '#components/use-route-overlay';
import { ProductInfo } from './product-info.js';

export function CloseProduct() {
  const { close } = useRouteOverlay();
  const { t } = useTranslation();
  return <Button onClick={() => void close()}>{t('layouts.done')}</Button>;
}

export default function ProductSummary() {
  const { t } = useTranslation();
  return (
    <RouteDialog
      title={t('layouts.summaryTitle')}
      description={t('layouts.readOnly')}
      className='sm:max-w-md'
      footer={<CloseProduct />}
    >
      <ProductInfo />
    </RouteDialog>
  );
}
