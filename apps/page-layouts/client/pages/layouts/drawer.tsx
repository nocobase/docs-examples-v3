import { useTranslation } from '@nocobase/i18n/client';
import { RouteDrawer } from '#components/route-drawer';
import { ProductInfo } from './product-info.js';
import { CloseProduct } from './summary.js';

export default function ProductDrawer() {
  const { t } = useTranslation();
  return (
    <RouteDrawer
      title={t('layouts.drawerTitle')}
      description={t('layouts.readOnly')}
      footer={<CloseProduct />}
    >
      <ProductInfo extended />
    </RouteDrawer>
  );
}
