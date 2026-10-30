import { CustomersContext } from './context.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useSearchParams, useNavigate } from 'react-router';
import { useApiClient, ApiClientError } from '@nocobase/app-client';
import { useCan } from '@nocobase/app-plugin-authorization/client';
import { useTranslation } from '@nocobase/i18n/client';
import { Plus, RefreshCw, UsersRound, Search } from 'lucide-react';
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
import { Alert, AlertDescription } from '#components/ui/alert';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '#components/ui/empty';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '#components/ui/tooltip';
import { Skeleton } from '#components/ui/skeleton';
import {
  StatusBadge,
  DateText,
  TruncatedTitle,
  CustomerError,
} from './shared.js';
import { CustomerActions } from './customer-actions.js';
import { statuses, type Customer, type CustomerList } from './types.js';

export default function CustomersPage() {
  const api = useApiClient();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can: canCreate } = useCan({
    resource: { type: 'composite', id: 'customers' },
    action: 'create',
  });
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = statuses.find((s) => s === params.get('status')) ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize =
    [10, 20, 50].find((n) => n === Number(params.get('pageSize'))) ?? 10;
  const orderBy =
    [
      'updatedAt:desc',
      'updatedAt:asc',
      'nextFollowUpDate:asc',
      'nextFollowUpDate:desc',
    ].find((s) => s === params.get('orderBy')) ?? 'updatedAt:desc';
  const query = new URLSearchParams({
    q,
    status,
    page: String(page),
    pageSize: String(pageSize),
    orderBy,
  });
  if (!status) query.delete('status');
  const queryKey = query.toString();
  const search = params.size ? `?${params.toString()}` : '';
  const [draft, setDraft] = useState(q);
  const [composing, setComposing] = useState(false);
  const [updates, setUpdates] = useState<Record<string, Customer>>({});
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const [result, setResult] = useState<CustomerList>();
  const [settled, setSettled] = useState('');
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const mutationRef = useRef(false);
  const [savedRefreshFailed, setSavedRefreshFailed] = useState(false);
  const generationRef = useRef(0);
  const requestKey = `${queryKey}|${revision}`;
  const loading = settled !== requestKey;
  const reload = useCallback(() => setRevision((r) => r + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    const current = ++generationRef.current;
    void api
      .request<CustomerList>({
        path: `customers?${queryKey}`,
        signal: controller.signal,
      })
      .then(
        (next) => {
          if (current !== generationRef.current || controller.signal.aborted)
            return;
          if (next.meta.page !== page)
            setParams(
              (current) => {
                const corrected = new URLSearchParams(current);
                corrected.set('page', String(next.meta.page));
                return corrected;
              },
              { replace: true },
            );
          setResult(next);
          setUpdates((old) => {
            const reconciled = { ...old };
            for (const row of next.data)
              if (
                reconciled[row.id] &&
                row.updatedAt >= reconciled[row.id].updatedAt
              )
                delete reconciled[row.id];
            return reconciled;
          });
          setError(undefined);
          setSettled(requestKey);
          mutationRef.current = false;
          setSavedRefreshFailed(false);
        },
        (next: unknown) => {
          if (current !== generationRef.current || controller.signal.aborted)
            return;
          setSettled(requestKey);
          setError(next);
          setSavedRefreshFailed(mutationRef.current);
          if (
            next instanceof ApiClientError &&
            [401, 403].includes(next.status)
          )
            setResult(undefined);
        },
      );
    return () => controller.abort();
  }, [api, queryKey, revision, requestKey, page, setParams]);
  useEffect(() => {
    if (composing || draft.trim() === q) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (draft.trim()) next.set('q', draft.trim());
      else next.delete('q');
      next.set('page', '1');
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, q, composing, params, setParams]);
  const [previousQuery, setPreviousQuery] = useState(q);
  if (q !== previousQuery && !composing) {
    setPreviousQuery(q);
    setDraft(q);
  }
  const update = (values: Record<string, string>) => {
    const next = new URLSearchParams(params);
    // Include pending search input when another control changes before its debounce settles.
    if (!composing && !('q' in values)) {
      if (draft.trim()) next.set('q', draft.trim());
      else next.delete('q');
    }
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  };
  const changed = (customer: Customer, created = false) => {
    ++generationRef.current;
    mutationRef.current = true;
    setError(undefined);
    setUpdates((old) => ({ ...old, [customer.id]: customer }));
    const matches =
      created ||
      ((!status || status === customer.status) &&
        (!q || customer.title.toLowerCase().includes(q.toLowerCase())));
    setResult((old) => {
      const existed = old?.data.some((row) => row.id === customer.id) ?? false;
      const data = (old?.data ?? []).filter((row) => row.id !== customer.id);
      if (matches) data.unshift(customer);
      return {
        data: data.slice(0, pageSize),
        meta: {
          page: created ? 1 : page,
          pageSize,
          total: Math.max(
            0,
            (old?.meta.total ?? 0) +
              (created ? 1 : existed && !matches ? -1 : 0),
          ),
        },
      };
    });
    if (created) void navigate('/customers', { replace: true });
    reload();
  };
  const removed = (id: string, committed = true) => {
    setMissingIds((old) => [...old, id]);
    setUpdates((old) => {
      const next = { ...old };
      delete next[id];
      return next;
    });
    ++generationRef.current;
    mutationRef.current = committed;
    setResult((old) =>
      old
        ? {
            data: old.data.filter((row) => row.id !== id),
            meta: { ...old.meta, total: Math.max(0, old.meta.total - 1) },
          }
        : old,
    );
    reload();
  };
  // Toolbar minimum widths keep search and translated status choices usable; flex wrapping handles narrow screens.
  const newButton = (
    <Button nativeButton={false} render={<Link to={`new${search}`} />}>
      <Plus />
      {t('customers.new')}
    </Button>
  );
  const filtered = !!q || !!status;
  const empty = (
    <Empty className='min-h-48 border border-dashed'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>
          <UsersRound />
        </EmptyMedia>
        <EmptyTitle>
          {t(filtered ? 'customers.noResults' : 'customers.emptyTitle')}
        </EmptyTitle>
        <EmptyDescription>
          {t(
            filtered
              ? 'customers.noResultsHint'
              : canCreate
                ? 'customers.emptyDescription'
                : 'customers.emptyReadonly',
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {filtered ? (
          <Button
            variant='outline'
            onClick={() => update({ q: '', status: '', page: '1' })}
          >
            {t('customers.clear')}
          </Button>
        ) : canCreate ? (
          newButton
        ) : null}
      </EmptyContent>
    </Empty>
  );
  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: 'title',
      header: t('customers.customerTitle'),
      cell: ({ row }) => (
        <RecordLink to={`${row.original.id}${search}`}>
          <TruncatedTitle>{row.original.title}</TruncatedTitle>
        </RecordLink>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'contact',
      header: t('customers.contact'),
      cell: ({ row }) => (
        <TruncatedTitle>{row.original.contact || '—'}</TruncatedTitle>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'status',
      header: t('customers.status'),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      enableSorting: false,
    },
    {
      accessorKey: 'salesOwnerName',
      header: t('customers.salesOwner'),
      cell: ({ row }) => (
        <TruncatedTitle>
          {row.original.salesOwnerName ?? t('customers.unassigned')}
        </TruncatedTitle>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'nextFollowUpDate',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('customers.nextFollowUpDate')}
        />
      ),
      cell: ({ row }) => (
        <span className='whitespace-nowrap'>
          <DateText value={row.original.nextFollowUpDate} />
        </span>
      ),
    },
    {
      accessorKey: 'updatedAt',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('customers.updatedAt')}
        />
      ),
      cell: ({ row }) => (
        <span className='whitespace-nowrap text-muted-foreground'>
          <DateText value={row.original.updatedAt} timestamp />
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => <CustomerActions customer={row.original} />,
    },
  ];
  const pagination = { pageIndex: (result?.meta.page ?? page) - 1, pageSize };
  const sorting = [
    { id: orderBy.split(':')[0], desc: orderBy.endsWith('desc') },
  ];
  return (
    <CustomersContext.Provider
      value={{
        changed,
        removed,
        reload,
        customers: result?.data ?? [],
        updates,
        search,
        refreshVersion: revision,
        missingIds,
      }}
    >
      <PageContainer>
        <PageHeader
          title={t('customers.title')}
          description={t('customers.subtitle')}
          actions={
            <>
              {canCreate && !!result && (filtered || !!result.data.length)
                ? newButton
                : null}{' '}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant='outline'
                      size='icon'
                      aria-label={t('customers.refresh')}
                      disabled={loading}
                      onClick={reload}
                    >
                      <RefreshCw className={loading ? 'animate-spin' : ''} />
                    </Button>
                  }
                />
                <TooltipContent>{t('customers.refresh')}</TooltipContent>
              </Tooltip>
            </>
          }
        />
        <div className='flex flex-wrap items-center gap-2'>
          <form
            className='relative min-w-48 flex-1 sm:max-w-72'
            onSubmit={(event) => {
              event.preventDefault();
              if (composing) return;
              update({ q: draft.trim(), page: '1' });
            }}
          >
            <Search className='pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground' />
            <Input
              id='customer-search'
              className='pl-9'
              aria-label={t('customers.search')}
              placeholder={t('customers.search')}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={(event) => {
                setComposing(false);
                setDraft(event.currentTarget.value);
              }}
            />
          </form>
          <Select
            value={status || 'all'}
            onValueChange={(value) =>
              update({
                status: value === 'all' ? '' : (value ?? ''),
                page: '1',
              })
            }
          >
            <SelectTrigger aria-label={t('customers.status')} className='w-40'>
              <SelectValue>
                {status ? t(`customers.${status}`) : t('customers.all')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className='w-auto min-w-(--anchor-width) max-w-[min(var(--container-sm),var(--available-width))] [&_[data-slot=select-item]>:first-child]:whitespace-normal'>
              <SelectItem value='all'>{t('customers.all')}</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`customers.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtered && (
            <Button
              variant='ghost'
              onClick={() => update({ q: '', status: '', page: '1' })}
            >
              {t('customers.clear')}
            </Button>
          )}
        </div>
        {savedRefreshFailed && (
          <Alert>
            <AlertDescription>{t('customers.reloadFailed')}</AlertDescription>
          </Alert>
        )}
        <CustomerError
          reading
          error={error}
          retry={reload}
          reset={() => {
            setDraft('');
            setParams({}, { replace: true });
          }}
        />
        {loading && !result ? (
          <div
            aria-label={t('customers.loading')}
            className='flex flex-col gap-3'
          >
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
              const value =
                typeof next === 'function' ? next(pagination) : next;
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
        <Outlet />
      </PageContainer>
    </CustomersContext.Provider>
  );
}
