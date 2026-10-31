import { Link, Outlet } from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { Button } from '#components/ui/button';
export default function AdminNotes() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader
        title={t('demo.adminNotes')}
        description={t('demo.adminDescription')}
      />
      <Button nativeButton={false} render={<Link to='child' />}>
        {t('demo.openChild')}
      </Button>
      <Outlet />
    </PageContainer>
  );
}
