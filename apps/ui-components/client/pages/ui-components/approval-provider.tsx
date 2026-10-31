import type { ReactNode } from 'react';
import { useTranslation } from '@nocobase/i18n/client';
import { ApprovalUiProvider } from '#extensions/nocobase-approval-ui/index';
import { Avatar, AvatarFallback } from '#components/ui/avatar';
import { people } from './data.js';
export function CatalogApprovalProvider({
  children,
}: {
  children?: ReactNode;
}) {
  const { i18n } = useTranslation();
  const name = (id: string) => people[id] ?? id;
  return (
    <ApprovalUiProvider
      personName={name}
      renderAvatar={(id) => (
        <Avatar className='size-7'>
          <AvatarFallback>
            {name(id)
              .split(' ')
              .map((word) => word[0])
              .join('')}
          </AvatarFallback>
        </Avatar>
      )}
      formatDateTime={(iso) =>
        new Intl.DateTimeFormat(i18n.language, {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'UTC',
        }).format(new Date(iso)) + ' UTC'
      }
    >
      {children}
    </ApprovalUiProvider>
  );
}
