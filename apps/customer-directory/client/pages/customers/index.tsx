import { useCan } from '@nocobase/app-plugin-authorization/client';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '#components/ui/collapsible';
import { useMemo, useState } from 'react';
import { Link, Outlet } from 'react-router';
import { ApiClientError } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Plus, RefreshCw } from 'lucide-react';
import { DataTable, DataTableColumnHeader } from '#components/data-table';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { RecordLink } from '#components/record-link';
import { StatusBadge } from '#components/status-badge';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Alert, AlertDescription } from '#components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '#components/ui/dropdown-menu';
import { Choice } from './choice.js';
import { DeleteCustomer } from './delete.js';
import { useCustomerList } from './use-customer-list.js';
import { errorKey, type Customer } from './api.js';

export default function CustomersPage() {
  const { t } = useTranslation();
  const { can: canCreate } = useCan({
    resource: { type: 'composite', id: 'customers' },
    action: 'create',
  });
  const { can: canEdit } = useCan({
    resource: { type: 'composite', id: 'customers' },
    action: 'edit',
  });
  const { can: canDelete } = useCan({
    resource: { type: 'composite', id: 'customers' },
    action: 'delete',
  });
  const [mode, setMode] = useState('normal');
  const request = useCustomerList(mode);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const search = request.params.toString() ? `?${request.params}` : '';
  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      ...(['name', 'contact', 'email', 'status'] as const).map((field) => ({
        accessorKey: field,
        header: ({
          column,
        }: {
          column: import('@tanstack/react-table').Column<Customer>;
        }) => (
          <DataTableColumnHeader
            column={column}
            title={t(`customers.${field}`)}
          />
        ),
        cell: ({
          row,
        }: {
          row: import('@tanstack/react-table').Row<Customer>;
        }) =>
          field === 'name' ? (
            <RecordLink to={`${row.original.id}${search}`}>
              {row.original.name}
            </RecordLink>
          ) : field === 'status' ? (
            <StatusBadge
              tone={row.original.status === 'active' ? 'success' : 'neutral'}
            >
              {t(`customers.${row.original.status}`)}
            </StatusBadge>
          ) : (
            row.original[field]
          ),
      })),
      {
        id: 'actions',
        cell: ({ row }) =>
          canEdit || canDelete ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant='ghost'
                    size='icon'
                    aria-label={t('customers.rowActions', {
                      name: row.original.name,
                    })}
                  />
                }
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                {canEdit ? (
                  <DropdownMenuItem
                    render={<Link to={`edit/${row.original.id}${search}`} />}
                  >
                    {t('customers.edit')}
                  </DropdownMenuItem>
                ) : null}
                {canDelete ? (
                  <DropdownMenuItem
                    variant='destructive'
                    onClick={() => {
                      setDeleteTarget(row.original);
                      setDeleteOpen(true);
                    }}
                  >
                    {t('customers.delete')}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null,
      },
    ],
    [t, search, canEdit, canDelete],
  );
  const denied =
    request.error instanceof ApiClientError &&
    [401, 403, 404].includes(request.error.status);
  const listState = denied
    ? request.error instanceof ApiClientError && request.error.status === 401
      ? 'unauthenticated'
      : 'forbidden'
    : request.error || request.table.error
      ? request.data
        ? 'refresh-failed'
        : 'failed'
      : request.loading && !request.data
        ? 'loading'
        : (request.data?.meta.total ?? 0) === 0
          ? request.q || request.status !== 'all'
            ? 'no-results'
            : 'empty'
          : 'ready';
  return (
    <>
      <PageContainer>
        <PageHeader
          title={t('customers.title')}
          description={t('customers.description')}
          actions={
            <>
              <Button
                variant='outline'
                onClick={request.reload}
                disabled={request.loading && request.active}
              >
                <RefreshCw data-icon='inline-start' />
                {t('customers.refresh')}
              </Button>
              {canCreate ? (
                <Button
                  nativeButton={false}
                  render={<Link to={`new${search}`} />}
                >
                  <Plus data-icon='inline-start' />
                  {t('customers.new')}
                </Button>
              ) : null}
            </>
          }
        />
        <div className='flex flex-wrap items-end gap-3'>
          <Search
            key={request.q}
            value={request.q}
            onSearch={(v) => request.setFilter('q', v)}
          />
          <Choice
            label={t('customers.status')}
            value={request.status}
            options={['all', 'active', 'inactive'].map((value) => ({
              value,
              label: t(`customers.${value}`),
            }))}
            onChange={(v) => request.setFilter('status', v)}
          />
        </div>
        <Collapsible className='rounded-lg border p-4'>
          <CollapsibleTrigger className='cursor-pointer text-sm font-medium'>
            {t('customers.demoControls')}
          </CollapsibleTrigger>
          <CollapsibleContent className='mt-4 flex flex-wrap items-end gap-4'>
            <Choice
              label={t('customers.readMode')}
              value={mode}
              options={['normal', 'slow', 'fail', 'race'].map((value) => ({
                value,
                label: t(`customers.readModes.${value}`),
              }))}
              onChange={setMode}
            />
            <p className='max-w-xl text-sm text-muted-foreground'>
              {t('customers.demoHelp')}
            </p>
          </CollapsibleContent>
        </Collapsible>
        <div className='min-h-6 text-sm text-muted-foreground' role='status'>
          {request.loading && request.data && request.active
            ? t('customers.refreshing')
            : request.data && !denied
              ? t('customers.count', { count: request.data.meta.total })
              : ''}
        </div>
        {request.error || request.table.error ? (
          <Alert variant='destructive'>
            <AlertDescription>
              {t(errorKey(request.error ?? request.table.error))}
            </AlertDescription>
          </Alert>
        ) : null}
        <DataTable
          columns={columns}
          data={denied ? [] : (request.data?.data ?? [])}
          manualPagination
          rowCount={request.data?.meta.total ?? 0}
          manualSorting
          {...request.table}
          pageSizeOptions={[5, 10, 20]}
          listState={listState}
          onRetry={() => {
            if (mode === 'fail') setMode('normal');
            else request.reload();
          }}
          onClearFilters={request.clearFilters}
        />
        <DeleteCustomer
          customer={deleteTarget}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={request.reload}
        />
      </PageContainer>
      <Outlet context={{ reload: request.reload }} />
    </>
  );
}
function Search({
  value,
  onSearch,
}: {
  value: string;
  onSearch: (v: string) => void;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState(value);
  return (
    <form
      className='flex items-end gap-2'
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(input.trim());
      }}
    >
      <div className='grid gap-2'>
        <label htmlFor='customer-search' className='text-sm font-medium'>
          {t('customers.search')}
        </label>
        <Input
          id='customer-search'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('customers.searchPlaceholder')}
        />
      </div>
      <Button type='submit' variant='outline'>
        {t('customers.searchAction')}
      </Button>
    </form>
  );
}
