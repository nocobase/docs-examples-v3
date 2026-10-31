import {
  Navigate,
  NavLink,
  Outlet,
  matchPath,
  useLocation,
  useResolvedPath,
} from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { Button } from '#components/ui/button';
export default function ReportsPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const parent = useResolvedPath('.');
  if (matchPath({ path: parent.pathname, end: true }, location.pathname))
    return (
      <Navigate replace to={{ pathname: 'summary', search: location.search }} />
    );
  return (
    <PageContainer>
      <PageHeader title={t('demo.reports')} />
      <nav aria-label={t('demo.reportViews')} className='flex gap-2'>
        {['summary', 'owners'].map((view) => (
          <Button
            key={view}
            variant='outline'
            nativeButton={false}
            render={
              <NavLink
                to={{ pathname: view, search: location.search }}
                className='aria-[current=page]:bg-accent'
              />
            }
          >
            {t(`demo.${view}`)}
          </Button>
        ))}
      </nav>
      <Outlet />
    </PageContainer>
  );
}
