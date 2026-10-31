import { useListData } from '#hooks/use-list-data';
import { useListLocation } from '#hooks/use-list-location';
import {
  readTableUrlState,
  useTableUrlState,
} from '#hooks/use-table-url-state';
import type { CustomerList } from './api.js';
const tableOptions = {
  sortColumns: ['name', 'contact', 'email', 'status'],
  defaultSorting: [{ id: 'name', desc: false }],
  defaultPageSize: 10,
  pageSizeOptions: [5, 10, 20],
};
export function useCustomerList(mode: string) {
  const { params, setParams, active } = useListLocation();
  const q = params.get('q') ?? '';
  const status = ['active', 'inactive'].includes(params.get('status') ?? '')
    ? params.get('status')!
    : 'all';
  const parsed = readTableUrlState(params, tableOptions);
  const sort = parsed.sortingState[0];
  const query = new URLSearchParams({
    q,
    status,
    page: String(parsed.paginationState.pageIndex + 1),
    pageSize: String(parsed.paginationState.pageSize),
    sort: sort?.id ?? 'name',
    order: sort?.desc ? 'desc' : 'asc',
    demo: mode,
  });
  const request = useListData<CustomerList>(`customerList?${query}`, {
    active,
  });
  const table = useTableUrlState({
    ...tableOptions,
    active,
    revision: request.revision,
    rowCount:
      !request.loading && !request.error ? request.data?.meta.total : undefined,
  });
  function setFilter(name: 'q' | 'status', value: string) {
    setParams(
      (old) => {
        const next = new URLSearchParams(old);
        if (value && value !== 'all') next.set(name, value);
        else next.delete(name);
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  }
  function clearFilters() {
    setParams(
      (old) => {
        const next = new URLSearchParams(old);
        next.delete('q');
        next.delete('status');
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  }
  return {
    ...request,
    table,
    q,
    status,
    params,
    active,
    setFilter,
    clearFilters,
  };
}
