import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useSearchParams } from 'react-router';
import { useApiClient, useToaster } from '@nocobase/app-client';
import { useCan } from '@nocobase/app-plugin-authorization/client';
import { useTranslation } from '@nocobase/i18n/client';
import { Laptop, MoreHorizontal, Plus, RefreshCw, Search } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { DataTable, DataTableColumnHeader } from '#components/data-table';
import { RecordLink } from '#components/record-link';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '#components/ui/select';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '#components/ui/empty';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '#components/ui/alert-dialog';
import { Skeleton } from '#components/ui/skeleton';
import { DeviceError, DeviceStatusBadge } from './shared.js';
import {
  deviceCategories,
  deviceStatuses,
  type Device,
  type DeviceList,
} from './types.js';

export interface DevicesOutletContext {
  reload: () => void;
  search: string;
}

export default function DevicesPage() {
  const api = useApiClient();
  const toaster = useToaster();
  const { t } = useTranslation();
  const { can: canCreate } = useCan({
    resource: { type: 'composite', id: 'devices' },
    action: 'create',
  });
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = deviceStatuses.find((s) => s === params.get('status')) ?? '';
  const category =
    deviceCategories.find((s) => s === params.get('category')) ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize =
    [10, 20, 50].find((n) => n === Number(params.get('pageSize'))) ?? 10;
  const orderBy =
    ['updatedAt:desc', 'updatedAt:asc', 'assetTag:asc', 'assetTag:desc'].find(
      (s) => s === params.get('orderBy'),
    ) ?? 'updatedAt:desc';
  const query = new URLSearchParams({
    q,
    page: String(page),
    pageSize: String(pageSize),
    orderBy,
  });
  if (status) query.set('status', status);
  if (category) query.set('category', category);
  const queryKey = query.toString();
  const search = params.size ? `?${params.toString()}` : '';
  const [draft, setDraft] = useState(q);
  const [result, setResult] = useState<DeviceList>();
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const [settled, setSettled] = useState('');
  const [deleting, setDeleting] = useState<Device>();
  const [deleteBusy, setDeleteBusy] = useState(false);
  const requestKey = `${queryKey}|${revision}`;
  const loading = settled !== requestKey;
  const reload = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    void api
      .request<DeviceList>({
        path: `devices?${queryKey}`,
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
  useEffect(() => {
    if (draft.trim() === q) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (draft.trim()) next.set('q', draft.trim());
      else next.delete('q');
      next.set('page', '1');
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, q, params, setParams]);

  const clear = () => {
    setDraft('');
    update({ q: '', status: '', category: '', page: '1' });
  };
  const remove = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.request({ path: `devices/${deleting.id}`, method: 'DELETE' });
      toaster.show({
        type: 'success',
        title: t('devices.deleted', { assetTag: deleting.assetTag }),
      });
      setDeleting(undefined);
      reload();
    } catch (next) {
      setError(next);
      setDeleting(undefined);
    } finally {
      setDeleteBusy(false);
    }
  };

  const filtered = !!q || !!status || !!category;
  const newButton = (
    <Button nativeButton={false} render={<Link to={`new${search}`} />}>
      <Plus />
      {t('devices.new')}
    </Button>
  );
  const empty = (
    <Empty className='min-h-48 border border-dashed'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>
          <Laptop />
        </EmptyMedia>
        <EmptyTitle>
          {t(filtered ? 'devices.noResults' : 'devices.emptyTitle')}
        </EmptyTitle>
        <EmptyDescription>
          {t(
            filtered
              ? 'devices.noResultsHint'
              : canCreate
                ? 'devices.emptyDescription'
                : 'devices.emptyReadonly',
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {filtered ? (
          <Button variant='outline' onClick={clear}>
            {t('devices.clear')}
          </Button>
        ) : canCreate ? (
          newButton
        ) : null}
      </EmptyContent>
    </Empty>
  );
  const columns: ColumnDef<Device>[] = [
    {
      accessorKey: 'assetTag',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('devices.assetTag')} />
      ),
      cell: ({ row }) =>
        row.original.permissions.edit ? (
          <RecordLink to={`edit/${row.original.id}${search}`}>
            {row.original.assetTag}
          </RecordLink>
        ) : (
          <span className='font-medium'>{row.original.assetTag}</span>
        ),
    },
    { accessorKey: 'name', header: t('devices.name'), enableSorting: false },
    {
      accessorKey: 'category',
      header: t('devices.category'),
      cell: ({ row }) => t(`devices.categories.${row.original.category}`),
      enableSorting: false,
    },
    {
      accessorKey: 'serialNumber',
      header: t('devices.serialNumber'),
      cell: ({ row }) => (
        <span className='font-mono text-xs'>
          {row.original.serialNumber ?? '—'}
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'status',
      header: t('devices.status'),
      cell: ({ row }) => <DeviceStatusBadge status={row.original.status} />,
      enableSorting: false,
    },
    {
      accessorKey: 'assigneeName',
      header: t('devices.assignee'),
      cell: ({ row }) =>
        row.original.assigneeName ?? (
          <span className='text-muted-foreground'>—</span>
        ),
      enableSorting: false,
    },
    {
      accessorKey: 'location',
      header: t('devices.location'),
      cell: ({ row }) =>
        row.original.location || (
          <span className='text-muted-foreground'>—</span>
        ),
      enableSorting: false,
    },
    {
      id: 'actions',
      cell: ({ row }) =>
        row.original.permissions.edit || row.original.permissions.delete ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant='ghost'
                  size='icon'
                  aria-label={t('devices.actions')}
                >
                  <MoreHorizontal />
                </Button>
              }
            />
            <DropdownMenuContent align='end'>
              {row.original.permissions.edit && (
                <DropdownMenuItem
                  render={<Link to={`edit/${row.original.id}${search}`} />}
                >
                  {t('devices.edit')}
                </DropdownMenuItem>
              )}
              {row.original.permissions.delete && (
                <DropdownMenuItem
                  variant='destructive'
                  onClick={() => setDeleting(row.original)}
                >
                  {t('devices.delete')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];
  const pagination = { pageIndex: (result?.meta.page ?? page) - 1, pageSize };
  const sorting = [
    { id: orderBy.split(':')[0], desc: orderBy.endsWith('desc') },
  ];
  const context: DevicesOutletContext = { reload, search };

  return (
    <PageContainer>
      <PageHeader
        title={t('devices.title')}
        description={t('devices.subtitle')}
        actions={
          <>
            {canCreate && newButton}
            <Button
              variant='outline'
              size='icon'
              aria-label={t('devices.refresh')}
              disabled={loading}
              onClick={reload}
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} />
            </Button>
          </>
        }
      />
      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative min-w-48 flex-1 sm:max-w-96'>
          <Search className='pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground' />
          <Input
            id='device-search'
            className='pl-9'
            aria-label={t('devices.search')}
            placeholder={t('devices.search')}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <Select
          value={status || 'all'}
          onValueChange={(value) =>
            update({ status: value === 'all' ? '' : String(value), page: '1' })
          }
        >
          <SelectTrigger aria-label={t('devices.status')} className='w-36'>
            <SelectValue>
              {status
                ? t(`devices.statuses.${status}`)
                : t('devices.allStatuses')}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('devices.allStatuses')}</SelectItem>
            {deviceStatuses.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`devices.statuses.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={category || 'all'}
          onValueChange={(value) =>
            update({
              category: value === 'all' ? '' : String(value),
              page: '1',
            })
          }
        >
          <SelectTrigger aria-label={t('devices.category')} className='w-36'>
            <SelectValue>
              {category
                ? t(`devices.categories.${category}`)
                : t('devices.allCategories')}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('devices.allCategories')}</SelectItem>
            {deviceCategories.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`devices.categories.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered && (
          <Button variant='ghost' onClick={clear}>
            {t('devices.clear')}
          </Button>
        )}
      </div>
      <DeviceError reading error={error} retry={reload} />
      {loading && !result ? (
        <div aria-label={t('devices.loading')} className='flex flex-col gap-3'>
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
          manualSorting
          sortingState={sorting}
          onSortingChange={(next) => {
            const value = typeof next === 'function' ? next(sorting) : next;
            update({
              orderBy: value[0]
                ? `${value[0].id}:${value[0].desc ? 'desc' : 'asc'}`
                : 'updatedAt:desc',
              page: '1',
            });
          }}
          loading={loading}
          emptyMessage={empty}
        />
      ) : null}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => !open && !deleteBusy && setDeleting(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('devices.deleteTitle', { assetTag: deleting?.assetTag })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('devices.deleteHint')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant='outline'
              disabled={deleteBusy}
              onClick={() => setDeleting(undefined)}
            >
              {t('devices.cancel')}
            </Button>
            <Button
              variant='destructive'
              disabled={deleteBusy}
              onClick={() => void remove()}
            >
              {t(deleteBusy ? 'devices.deleting' : 'devices.delete')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Outlet context={context} />
    </PageContainer>
  );
}
