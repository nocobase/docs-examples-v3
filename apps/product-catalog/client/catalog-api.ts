import type { ApiClient } from '@nocobase/app-client';
export type Category = { id: string; title: string };
export async function loadCategories(api: ApiClient) {
  return api.repository<Category>('publicCategories').findMany({ limit: 20 });
}
