import { useEffect } from 'react';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router';
import { useAuthentication } from '@nocobase/app-plugin-authentication/client';
import { ApiClientError } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Plus, RefreshCw } from 'lucide-react';
import { DataTable, DataTableColumnHeader } from '#components/data-table';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { LongTextPreview } from '#components/long-text';
import { Input } from '#components/ui/input';
import { Button } from '#components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '#components/ui/dropdown-menu';
import { useListData } from '#hooks/use-list-data';
import {
  useAccess,
  type Customer,
  type Order,
  type ListResult,
} from './api.js';
export default function AccessList() {
  const { session } = useAuthentication();
  const location = useLocation();
  const kind = location.pathname.includes('/orders') ? 'orders' : 'customers';
  return <List key={`${session?.user.id}:${kind}`} kind={kind} />;
}
function List({ kind }: { kind: 'orders' | 'customers' }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const page = Math.min(
    10000,
    Math.max(1, Math.floor(Number(params.get('page')) || 1)),
  );
  const q = params.get('q') ?? '';
  const descending = params.get('descending') === 'true';
  const pageSize = [10, 20, 50].includes(Number(params.get('pageSize')))
    ? Number(params.get('pageSize'))
    : 10;
  const pagination = { pageIndex: page - 1, pageSize };
  const change = (values: Record<string, string>) =>
    setParams(
      (old) => {
        const next = new URLSearchParams(old);
        for (const [key, value] of Object.entries(values)) next.set(key, value);
        return next;
      },
      { replace: true },
    );
  const customers = kind === 'customers';
  const read = useAccess(customers ? 'viewCustomers' : 'viewOrders');
  const edit = useAccess(customers ? 'editCustomer' : 'assignCustomer');
  const create = useAccess('createCustomer');
  const request = useListData<ListResult<Customer & Order>>(
    `/${kind}?page=${pagination.pageIndex + 1}&pageSize=${pagination.pageSize}&q=${encodeURIComponent(q)}&descending=${descending}`,
    { active: read.can },
  );
  useEffect(() => {
    if (request.loading || request.error || !request.data) return;
    const lastPage = Math.max(1, Math.ceil(request.data.meta.total / pageSize));
    if (page > lastPage)
      void setParams(
        (old) => {
          const next = new URLSearchParams(old);
          next.set('page', String(lastPage));
          return next;
        },
        { replace: true },
      );
  }, [request.loading, request.error, request.data, page, pageSize, setParams]);
  const columns: ColumnDef<Customer & Order>[] = (
    customers ? ['name', 'email', 'notes'] : ['number']
  ).map((field) => ({
    accessorKey: field,
    cell: ({ getValue }) =>
      field === 'notes' ? (
        <LongTextPreview label={t('access.notes')} lines={2} className='w-64'>
          {getValue<string>() ?? ''}
        </LongTextPreview>
      ) : (
        <span
          className='block max-w-64 truncate'
          title={getValue<string>() ?? ''}
        >
          {getValue<string>() ?? ''}
        </span>
      ),
    enableSorting: field === (customers ? 'name' : 'number'),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t(`access.${field}`)} />
    ),
  }));
  if (edit.can)
    columns.push({
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant='ghost'
                size='icon'
                aria-label={t('access.actions', {
                  name: customers ? row.original.name : row.original.number,
                })}
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-auto min-w-40'>
            <DropdownMenuItem
              render={
                <Link
                  to={`${row.original.id}/${customers ? 'edit' : 'customer'}?${params}`}
                />
              }
            >
              {t(customers ? 'access.editCustomer' : 'access.assignCustomer')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    });
  const denied =
    request.error instanceof ApiClientError &&
    [401, 403, 404].includes(request.error.status);
  const listState = read.isPending
    ? 'loading'
    : request.error instanceof ApiClientError && request.error.status === 401
      ? 'unauthenticated'
      : !read.can || denied
        ? 'forbidden'
        : request.error
          ? request.data
            ? 'refresh-failed'
            : 'failed'
          : request.loading && !request.data
            ? 'loading'
            : request.data?.meta.total === 0
              ? q
                ? 'no-results'
                : 'empty'
              : 'ready';
  return (
    <>
      <PageContainer>
        <PageHeader
          title={t(`access.${kind}`)}
          description={t(
            customers ? 'access.customerHint' : 'access.orderHint',
          )}
          actions={
            <>
              <Button
                variant='outline'
                onClick={request.reload}
                disabled={request.loading || !read.can}
              >
                <RefreshCw
                  className={request.loading ? 'animate-spin' : undefined}
                />
                {t('access.refresh')}
              </Button>
              {customers &&
              create.can &&
              ['ready', 'empty', 'no-results', 'refresh-failed'].includes(
                listState,
              ) ? (
                <Button
                  nativeButton={false}
                  render={<Link to={`create?${params}`} />}
                >
                  <Plus />
                  {t('access.createCustomer')}
                </Button>
              ) : null}
            </>
          }
        />
        <Input
          aria-label={t(
            customers ? 'access.searchCustomers' : 'access.searchOrders',
          )}
          placeholder={t(
            customers ? 'access.searchCustomers' : 'access.searchOrders',
          )}
          value={q}
          maxLength={100}
          onChange={(event) =>
            void change({ q: event.target.value, page: '1' })
          }
        />
        {q ? (
          <Button
            variant='outline'
            onClick={() => void change({ q: '', page: '1' })}
          >
            {t('access.clearSearch')}
          </Button>
        ) : null}
        <DataTable
          columns={columns}
          data={!read.can || denied ? [] : (request.data?.data ?? [])}
          listState={listState}
          loading={request.loading}
          onRetry={
            !(request.error instanceof ApiClientError) ||
            request.error.status >= 500
              ? request.reload
              : undefined
          }
          manualPagination
          rowCount={request.data?.meta.total ?? 0}
          paginationState={pagination}
          onPaginationChange={(value) => {
            const next =
              typeof value === 'function' ? value(pagination) : value;
            void change({
              page: String(next.pageIndex + 1),
              pageSize: String(next.pageSize),
            });
          }}
          manualSorting
          sortingState={[
            { id: customers ? 'name' : 'number', desc: descending },
          ]}
          onSortingChange={(value) => {
            const next =
              typeof value === 'function'
                ? value([
                    { id: customers ? 'name' : 'number', desc: descending },
                  ])
                : value;
            void change({
              descending: String(next[0]?.desc ?? false),
              page: '1',
            });
          }}
          showSelectedCount={false}
          pageSizeOptions={[10, 20, 50]}
        />
      </PageContainer>
      <Outlet context={{ reload: request.reload }} />
    </>
  );
}
