import type { ReactElement, ReactNode } from 'react';
import type { To } from 'react-router';
import { usePageBreadcrumb } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import { PageHeader } from '#components/page-header';
import { Alert, AlertDescription } from '#components/ui/alert';
import { Button } from '#components/ui/button';
import { Skeleton } from '#components/ui/skeleton';

export function DataState({
  loading,
  data,
  status,
  retry,
}: {
  readonly loading: boolean;
  readonly data?: unknown;
  readonly status?: number;
  readonly retry: () => void;
}): ReactElement | null {
  const { t } = useTranslation();
  if (loading && data === undefined)
    return (
      <div
        aria-label={t('workflows.loading')}
        role='status'
        className='space-y-3'
      >
        <Skeleton className='h-8 w-full' />
        <Skeleton className='h-24 w-full' />
      </div>
    );
  if (!status) return null;
  return (
    <Alert variant='destructive'>
      <AlertDescription>
        {t(
          status === 403
            ? 'workflows.forbidden'
            : status === 404
              ? 'workflows.notFound'
              : 'workflows.failed',
        )}
        {status >= 500 && (
          <Button variant='outline' size='sm' onClick={retry}>
            {t('workflows.retry')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function WorkflowDetailPage({
  title,
  description,
  titleSuffix,
  listTitle,
  closeTo,
  children,
}: {
  title: string;
  description?: ReactNode;
  titleSuffix?: ReactNode;
  listTitle: string;
  closeTo: To;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  usePageBreadcrumb([
    { label: t('workflows.systemManagement') },
    { label: t('workflows.title'), to: '/settings/workflows' },
    { label: listTitle, to: closeTo },
    { label: title },
  ]);
  return (
    <section className='flex flex-col gap-4'>
      <PageHeader
        title={
          titleSuffix ? (
            <span className='flex flex-wrap items-baseline gap-x-4 gap-y-2'>
              <span>{title}</span>
              {titleSuffix}
            </span>
          ) : (
            title
          )
        }
        description={description}
      />
      {children}
    </section>
  );
}
