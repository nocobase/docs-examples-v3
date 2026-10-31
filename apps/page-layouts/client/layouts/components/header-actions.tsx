import { BookOpen } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import { Button } from '#components/ui/button';
import type { ReactElement } from 'react';
import { TooltipProvider } from '#components/ui/tooltip';

import { ThemeSettings } from '../../theme/index.js';
import { UserMenu } from './user-menu.js';

/** The header's right-hand actions, shared by every authenticated page. */
export function HeaderActions(): ReactElement {
  const { t } = useTranslation();
  return (
    <TooltipProvider>
      <div className='flex shrink-0 items-center gap-2'>
        {/* App-owned catalog entry; retain the template's theme and session controls. */}
        <Button
          variant='ghost'
          size='icon'
          aria-label={t('layouts.guide')}
          title={t('layouts.guide')}
          render={<Link to='/catalog-guide' />}
        >
          <BookOpen />
        </Button>
        <ThemeSettings />
        <UserMenu />
      </div>
    </TooltipProvider>
  );
}
