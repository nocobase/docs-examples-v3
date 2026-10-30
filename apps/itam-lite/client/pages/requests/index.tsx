import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useSearchParams } from 'react-router';
import { useApiClient } from '@nocobase/app-client';
import { useCan } from '@nocobase/app-plugin-authorization/client';
import { useLocale, useTranslation } from '@nocobase/i18n/client';
import { ClipboardList, Plus, RefreshCw } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { DataTable } from '#components/data-table';
import { RecordLink } from '#components/record-link';
import { Button } from '#components/ui/button';
import { Checkbox } from '#components/ui/checkbox';
import { Label } from '#components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#components/ui/empty';
import { Skeleton } from '#components/ui/skeleton';
import { DeviceError } from '../devices/shared.js';
import { formatDate } from './format.js';
import { RequestStateBadge } from './shared.js';
import {
  requestStates,
  type DeviceRequest,
  type RequestList,
} from './types.js';

export interface RequestsOutletContext {
  reload: () => void;
  search: string;
}

export default function RequestsPage() {
  const api = useApiClient();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { can: canCreate } = useCan({
    resource: { type: 'composite', id: 'deviceRequests' },
    action: 'create',
  });
  const [params, setParams] = useSearchParams();
  const status = requestStates.find((s) => s === params.get('status')) ?? '';
  const mine = params.get('mine') === 'true';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize =
    [10, 20, 50].find((n) => n === Number(params.get('pageSize'))) ?? 10;
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (status) query.set('status', status);
  if (mine) query.set('mine', 'true');
  const queryKey = query.toString();
  const search = params.size ? `?${params.toString()}` : '';
  const [result, setResult] = useState<RequestList>();
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const [settled, setSettled] = useState('');
  const requestKey = `${queryKey}|${revision}`;
  const loading = settled !== requestKey;
  const reload = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    void api
      .request<RequestList>({
        path: `requests?${queryKey}`,
        signal: controller.signal,
      })
      .then(
        (next) => {
          if (controller.signal.aborted) return;
          setResult(next);
          setError(undefined);
          setSettled(requestKey);
        },
        (next: unknown) => {
          if (controller.signal.aborted) return;
          setError(next);
          setSettled(requestKey);
        },
      );
    return () => controller.abort();
  }, [api, queryKey, requestKey]);

  const update = (values: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };
  const filtered = !!status || mine;
  const newButton = (
    <Button nativeButton={false} render={<Link to={`new${search}`} />}>
      <Plus />
      {t('requests.new')}
    </Button>
  );
  const columns: ColumnDef<DeviceRequest>[] = [
    {
      accessorKey: 'requestNo',
      header: t('requests.requestNo'),
      cell: ({ row }) => (
        <RecordLink to={`${row.original.id}${search}`}>
          {row.original.requestNo}
        </RecordLink>
      ),
    },
    { accessorKey: 'requesterName', header: t('requests.requester') },
    {
      accessorKey: 'category',
      header: t('requests.category'),
      cell: ({ row }) => t(`devices.categories.${row.original.category}`),
    },
    {
      accessorKey: 'reason',
      header: t('requests.reason'),
      cell: ({ row }) => (
        <span className='block max-w-72 truncate'>{row.original.reason}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('requests.status'),
      cell: ({ row }) => <RequestStateBadge state={row.original.status} />,
    },
    {
      accessorKey: 'deviceAssetTag',
      header: t('requests.device'),
      cell: ({ row }) =>
        row.original.deviceAssetTag ?? (
          <span className='text-muted-foreground'>—</span>
        ),
    },
    {
      accessorKey: 'createdAt',
      header: t('requests.createdAt'),
      cell: ({ row }) => (
        <span className='whitespace-nowrap text-muted-foreground'>
          {formatDate(row.original.createdAt, locale)}
        </span>
      ),
    },
  ];
  const empty = (
    <Empty className='min-h-48 border border-dashed'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>
          <ClipboardList />
        </EmptyMedia>
        <EmptyTitle>
          {t(filtered ? 'requests.noResults' : 'requests.emptyTitle')}
        </EmptyTitle>
        {!filtered && (
          <EmptyDescription>{t('requests.emptyDescription')}</EmptyDescription>
        )}
      </EmptyHeader>
      {!filtered && canCreate && <EmptyContent>{newButton}</EmptyContent>}
    </Empty>
  );
  const pagination = { pageIndex: (result?.meta.page ?? page) - 1, pageSize };
  const context: RequestsOutletContext = { reload, search };

  return (
    <PageContainer>
      <PageHeader
        title={t('requests.title')}
        description={t('requests.subtitle')}
        actions={
          <>
            {canCreate && newButton}
            <Button
              variant='outline'
              size='icon'
              aria-label={t('requests.refresh')}
              disabled={loading}
              onClick={reload}
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} />
            </Button>
          </>
        }
      />
      <div className='flex flex-wrap items-center gap-4'>
        <Select
          value={status || 'all'}
          onValueChange={(value) =>
            update({ status: value === 'all' ? '' : String(value), page: '1' })
          }
        >
          <SelectTrigger aria-label={t('requests.status')} className='w-40'>
            <SelectValue>
              {status
                ? t(`requests.states.${status}`)
                : t('requests.allStatuses')}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('requests.allStatuses')}</SelectItem>
            {requestStates.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`requests.states.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className='flex items-center gap-2'>
          <Checkbox
            id='requests-mine'
            checked={mine}
            onCheckedChange={(checked) =>
              update({ mine: checked ? 'true' : '', page: '1' })
            }
          />
          <Label htmlFor='requests-mine'>{t('requests.onlyMine')}</Label>
        </div>
      </div>
      <DeviceError reading error={error} retry={reload} />
      {loading && !result ? (
        <div aria-label={t('requests.loading')} className='flex flex-col gap-3'>
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className='h-12 w-full' />
          ))}
        </div>
      ) : result && !result.data.length && !filtered ? (
        empty
      ) : result ? (
        <DataTable
          columns={columns}
          data={result.data}
          getRowId={(row) => row.id}
          showSelectedCount={false}
          manualPagination
          rowCount={result.meta.total}
          paginationState={pagination}
          pageSizeOptions={[10, 20, 50]}
          onPaginationChange={(next) => {
            const value = typeof next === 'function' ? next(pagination) : next;
            update({
              page: String(value.pageIndex + 1),
              pageSize: String(value.pageSize),
            });
          }}
          loading={loading}
          emptyMessage={empty}
        />
      ) : null}
      <Outlet context={context} />
    </PageContainer>
  );
}
