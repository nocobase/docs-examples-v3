import { useTranslation } from '@nocobase/i18n/client';
import { Badge } from '#components/ui/badge';
/** Business meaning stays here; the installed Badge primitive stays unchanged. */
export function StockBadge({ stock }: { stock: number }) {
  const { t } = useTranslation();
  const state = stock === 0 ? 'out' : stock < 5 ? 'low' : 'available';
  return (
    <Badge
      variant={
        state === 'out' ? 'outline' : state === 'low' ? 'secondary' : 'default'
      }
    >
      {t(`catalog.stock.${state}`)}
    </Badge>
  );
}
