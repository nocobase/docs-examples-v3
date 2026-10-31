import { useTranslation } from '@nocobase/i18n/client';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '#components/ui/card';
import { StockBadge } from '#components/stock-badge';
import { initialProducts } from './data.js';
export default function CustomizePage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader
        title={t('catalog.custom.title')}
        description={t('catalog.custom.description')}
      />
      <div className='grid gap-4 md:grid-cols-3'>
        {initialProducts.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <CardDescription>{p.sku}</CardDescription>
            </CardHeader>
            <CardContent className='flex flex-col gap-3'>
              <div>
                <StockBadge stock={p.stock} />
              </div>
              <p className='text-sm text-muted-foreground'>
                {t('catalog.custom.units', { count: p.stock })}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
