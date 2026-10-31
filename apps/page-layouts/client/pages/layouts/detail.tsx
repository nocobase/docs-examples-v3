import {
  NavLink,
  Navigate,
  Outlet,
  useParams,
  useLocation,
  useResolvedPath,
} from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import { RouteChildPage } from '#components/route-child-page';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { BackButton } from '#components/back-button';
import { products } from './data.js';

export default function ProductDetail() {
  const { productId } = useParams();
  const { t } = useTranslation();
  const location = useLocation();
  const ownPath = useResolvedPath('.');
  if (
    location.pathname.replace(/\/$/u, '') ===
    ownPath.pathname.replace(/\/$/u, '')
  ) {
    return (
      <Navigate
        replace
        to={{ pathname: 'overview', search: location.search }}
      />
    );
  }
  const product = products.find((item) => item.id === productId);
  return (
    <RouteChildPage>
      <PageContainer>
        <BackButton>{t('layouts.back')}</BackButton>
        <PageHeader
          title={product?.name ?? t('layouts.missing')}
          description={t('layouts.detailDescription')}
        />
        <nav
          aria-label={t('layouts.detailSections')}
          className='flex gap-6 border-b'
        >
          {['overview', 'handling'].map((section) => (
            <NavLink
              key={section}
              to={section}
              className={({ isActive }) =>
                `border-b-2 pb-3 text-sm font-medium ${isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`
              }
            >
              {t(`layouts.${section}`)}
            </NavLink>
          ))}
        </nav>
        <Outlet />
      </PageContainer>
    </RouteChildPage>
  );
}
