import { ApiClientError } from '@nocobase/app-client';
import { useCan } from '@nocobase/app-plugin-authorization/client';
export interface Customer {
  id: string;
  name: string;
  email: string;
  notes: string;
  ownerId: string;
}
export interface Order {
  id: string;
  number: string;
  customerId: string;
  ownerId: string;
}
export interface ListResult<T> {
  data: T[];
  meta: { total: number; page: number; pageSize: number };
}
export function useAccess(action: string) {
  return useCan({
    resource: { type: 'composite', id: 'customerAccess' },
    action,
  });
}
export function errorKey(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return 'access.signIn';
    if (error.status === 403) return 'access.denied';
    if (error.status === 404) return 'access.unavailable';
    if (error.status === 400) return 'access.invalid';
  }
  return 'access.failed';
}

export function isUnavailable(error: unknown) {
  return (
    error instanceof ApiClientError && [401, 403, 404].includes(error.status)
  );
}
