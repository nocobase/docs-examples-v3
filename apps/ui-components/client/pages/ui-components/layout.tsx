import { NavLink, Outlet } from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import { Button } from '#components/ui/button';
export default function DemoLayout() {
  const { t } = useTranslation();
  return (
    <main className='mx-auto w-full max-w-6xl'>
      <nav
        aria-label={t('catalog.demoNav')}
        className='flex flex-wrap gap-2 border-b p-6 pr-20 md:px-8'
      >
        {['catalog', 'review', 'customize'].map((tab) => (
          <Button
            key={tab}
            variant='ghost'
            nativeButton={false}
            render={
              <NavLink to={tab} className='aria-[current=page]:bg-muted' />
            }
          >
            {t(`catalog.tabs.${tab}`)}
          </Button>
        ))}
      </nav>
      <Outlet />
    </main>
  );
}
