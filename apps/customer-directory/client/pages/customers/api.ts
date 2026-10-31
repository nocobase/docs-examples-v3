import { ApiClientError, type ApiClient } from '@nocobase/app-client';
export interface Customer {
  id: string;
  name: string;
  contact: string;
  email: string;
  status: 'active' | 'inactive';
}
export type CustomerValues = Omit<Customer, 'id'>;
export interface CustomerList {
  data: Customer[];
  meta: { total: number };
}
export type WriteMode = 'normal' | 'reject' | 'lose' | 'slow';
export async function armWriteDemo(
  api: ApiClient,
  key: string,
  mode: WriteMode,
  signal: AbortSignal,
) {
  if (mode !== 'normal')
    await api.request({
      method: 'POST',
      path: 'customerDemo/nextWrite',
      json: { key, mode },
      signal,
    });
}
export async function saveCustomer(
  api: ApiClient,
  values: CustomerValues,
  id: string | undefined,
  key: string,
  signal: AbortSignal,
) {
  const repository = api.repository<Customer>('customers');
  const result = id
    ? await repository.updateOne({
        filter: { id },
        values,
        idempotencyKey: key,
        signal,
      })
    : await repository.createOne({
        values: { id: key.slice(14), ...values },
        idempotencyKey: key,
        signal,
      });
  return result.record;
}
export function errorKey(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return 'customers.unauthenticated';
    if (error.status === 403) return 'customers.forbidden';
    if (error.status === 404) return 'customers.missing';
    if (error.reason === 'DEMO_DISABLED') return 'customers.demoDisabled';
    if (error.reason === 'DEMO_SAVE_REJECTED') return 'customers.saveRejected';
    if (error.reason === 'INVALID_CUSTOMER') return 'customers.invalid';
  }
  return 'customers.failed';
}
