import { Link } from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { Button } from '#components/ui/button';

export default function CatalogGuide() {
  const { t } = useTranslation();
  return (
    <PageContainer className='mx-auto max-w-3xl pt-24'>
      <PageHeader
        title={t('layouts.guide')}
        description={t('layouts.guideDescription')}
      />
      <p className='leading-7 text-muted-foreground'>
        {t('layouts.guideBody')}
      </p>
      <Button render={<Link to='/layouts' />}>
        {t('layouts.openCatalog')}
      </Button>
    </PageContainer>
  );
}
