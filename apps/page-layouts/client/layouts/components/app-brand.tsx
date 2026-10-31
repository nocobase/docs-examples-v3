import { useTranslation } from '@nocobase/i18n/client';
import { resolveAssetUrl } from '@nocobase/app-client';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

export interface AppBrandProps {
  readonly compact?: boolean;
}

export function AppBrand(inputProps: AppBrandProps): ReactElement {
  const { t } = useTranslation();
  const { compact = false } = inputProps;

  // Keep the template's compact mark; show the catalog brand in expanded mode.
  return (
    <Link
      aria-label={t('layouts.brand')}
      className='flex min-w-0 items-center text-foreground'
      to='/'
    >
      {compact ? (
        <span className='size-9 shrink-0 overflow-hidden'>
          <img
            src={resolveAssetUrl('/assets/logo-mark.png')}
            alt=''
            className='size-full object-contain dark:hidden'
          />
          <img
            src={resolveAssetUrl('/assets/logo-mark-dark.png')}
            alt=''
            className='hidden size-full object-contain dark:block'
          />
        </span>
      ) : (
        <span className='truncate text-base font-semibold'>
          {t('layouts.brand')}
        </span>
      )}
    </Link>
  );
}
