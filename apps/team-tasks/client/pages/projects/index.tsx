import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router';
import { ApiClientError, useApiClient } from '@nocobase/app-client';
import { useCan } from '@nocobase/app-plugin-authorization/client';
import { useTranslation } from '@nocobase/i18n/client';
import { Plus, FolderKanban } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { DataTable } from '#components/data-table';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Skeleton } from '#components/ui/skeleton';
import { Spinner } from '#components/ui/spinner';
import { Alert, AlertDescription } from '#components/ui/alert';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '#components/ui/empty';
import type { Project, ProjectList } from './types.js';
import { ProjectName } from './project-name.js';

export default function ProjectsPage() {
  const { t } = useTranslation();
  const api = useApiClient();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const page = Math.max(1, Math.floor(Number(params.get('page')) || 1));
  const [draft, setDraft] = useState(q);
  const [previousQuery, setPreviousQuery] = useState(q);
  if (q !== previousQuery) {
    setPreviousQuery(q);
    setDraft(q);
  }
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const [result, setResult] = useState<ProjectList>();
  const [error, setError] = useState<unknown>();
  const requestKey = JSON.stringify([q, page, revision]);
  const [settledKey, setSettledKey] = useState('');
  const loading = requestKey !== settledKey;
  const { can: canCreate } = useCan({
    resource: { type: 'composite', id: 'projects' },
    action: 'create',
  });
  useEffect(() => {
    const controller = new AbortController();
    void api
      .request<ProjectList>({
        path: `projects?${new URLSearchParams({ q, page: String(page), pageSize: '10' })}`,
        signal: controller.signal,
      })
      .then(
        (next) => {
          if (controller.signal.aborted) return;
          setResult(next);
          setError(undefined);
          setSettledKey(requestKey);
          if (next.meta.page !== page)
            setParams(
              (current) => {
                const nextParams = new URLSearchParams(current);
                nextParams.set('page', String(next.meta.page));
                return nextParams;
              },
              { replace: true },
            );
        },
        (failure: unknown) => {
          if (controller.signal.aborted) return;
          setResult(undefined);
          setError(failure);
          setSettledKey(requestKey);
        },
      );
    return () => controller.abort();
  }, [api, q, page, requestKey, setParams]);
  const search = (value: string) => {
    const next = new URLSearchParams(params);
    if (value.trim()) next.set('q', value.trim());
    else next.delete('q');
    next.delete('page');
    setParams(next);
  };
  const createButton = canCreate ? (
    <Button
      nativeButton={false}
      render={<Link to={{ pathname: 'new', search: location.search }} />}
    >
      <Plus />
      {t('projects.new')}
    </Button>
  ) : null;
  const columns: ColumnDef<Project>[] = [
    {
      accessorKey: 'name',
      header: t('projects.name'),
      cell: ({ row }) => <ProjectName name={row.original.name} />,
    },
  ];
  const pagination = {
    pageIndex: (result?.meta.page ?? page) - 1,
    pageSize: 10,
  };
  const status = error instanceof ApiClientError ? error.status : undefined;
  return (
    <PageContainer>
      <PageHeader
        title={t('projects.title')}
        actions={result && (result.data.length > 0 || q) ? createButton : null}
      />
      <form
        className='flex flex-wrap items-center gap-2'
        onSubmit={(event) => {
          event.preventDefault();
          search(draft);
        }}
      >
        <Input
          id='project-search'
          aria-label={t('projects.search')}
          placeholder={t('projects.searchPlaceholder')}
          className='w-full sm:max-w-sm'
          value={draft}
          maxLength={120}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type='submit' variant='outline'>
          {t('projects.search')}
        </Button>
        {q ? (
          <Button
            type='button'
            variant='ghost'
            onClick={() => {
              setDraft('');
              search('');
            }}
          >
            {t('projects.clear')}
          </Button>
        ) : null}
      </form>
      {loading && result ? (
        <div
          role='status'
          className='flex items-center gap-2 text-sm text-muted-foreground'
        >
          <Spinner aria-hidden='true' />
          {t('projects.loading')}
        </div>
      ) : null}
      {loading && !result ? (
        <div className='rounded-lg border' aria-label={t('projects.loading')}>
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className='border-b p-3 last:border-b-0'>
              <Skeleton className={row === 0 ? 'h-5 w-28' : 'h-5 w-48'} />
            </div>
          ))}
        </div>
      ) : null}
      {error && !loading ? (
        <Alert variant='destructive'>
          <AlertDescription>
            <p>
              {t(
                status === 401
                  ? 'projects.signedOut'
                  : status === 403
                    ? 'projects.denied'
                    : 'projects.loadError',
              )}
            </p>
            {status === 401 ? (
              <Link to='/login'>{t('projects.signIn')}</Link>
            ) : status !== 403 ? (
              <Button variant='outline' onClick={reload}>
                {t('projects.retry')}
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {result && result.meta.total === 0 && !q ? (
        <Empty className='min-h-48 border border-dashed'>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <FolderKanban />
            </EmptyMedia>
            <EmptyTitle>{t('projects.empty')}</EmptyTitle>
            <EmptyDescription>
              {t(canCreate ? 'projects.emptyHint' : 'projects.readerEmpty')}
            </EmptyDescription>
          </EmptyHeader>
          {canCreate ? <EmptyContent>{createButton}</EmptyContent> : null}
        </Empty>
      ) : null}
      {result && (result.meta.total > 0 || q) ? (
        <DataTable
          className='[&_table]:table-fixed'
          columns={columns}
          data={result.data}
          getRowId={(row) => row.id}
          showSelectedCount={false}
          manualPagination
          rowCount={result.meta.total}
          paginationState={pagination}
          pageSizeOptions={[10]}
          onPaginationChange={(next) => {
            const value = typeof next === 'function' ? next(pagination) : next;
            const nextParams = new URLSearchParams(params);
            nextParams.set('page', String(value.pageIndex + 1));
            setParams(nextParams);
          }}
          loading={loading}
          emptyMessage={t('projects.noResults')}
        />
      ) : null}
      <Outlet context={{ reload }} />
    </PageContainer>
  );
}
