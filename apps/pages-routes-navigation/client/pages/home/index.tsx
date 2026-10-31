import { Link } from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { Button } from '#components/ui/button';
export default function HomePage() {
  const { t } = useTranslation();
  const examples = [
    ['/projects', 'projects'],
    ['/reports', 'reports'],
    ['/reports/exports', 'exports'],
    ['/reports/snapshot', 'snapshot'],
    ['/public-projects', 'publicProjects'],
    ['/welcome', 'welcome'],
    ['/admin-notes', 'adminNotes'],
    ['/route-status/loading', 'loaded'],
    ['/route-status/error', 'error'],
    ['/unknown-example', 'unknown'],
  ];
  return (
    <PageContainer>
      <PageHeader title={t('demo.title')} description={t('demo.intro')} />
      <p className='text-sm text-muted-foreground'>{t('demo.fixtures')}</p>
      <nav aria-label={t('demo.examples')} className='flex flex-wrap gap-3'>
        {examples.map(([to, label]) => (
          <Button
            key={to}
            variant='outline'
            nativeButton={false}
            render={<Link to={to} />}
          >
            {t(`demo.${label}`)}
          </Button>
        ))}
      </nav>
      <p className='text-sm text-muted-foreground'>
        {t('demo.permissionHint')}
      </p>
    </PageContainer>
  );
}
