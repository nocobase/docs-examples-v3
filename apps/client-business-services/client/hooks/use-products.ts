import { useService } from '@nocobase/app-client';
import { useEffect } from 'react';
import { useListData } from './use-list-data.js';
import { productsServiceToken } from '../services/tokens.js';
import type { Product } from '../services/products.js';
export function useProducts() {
  const products = useService(productsServiceToken);
  const request = useListData<{ data: Product[] }>('clientServiceProducts');
  const { reload } = request;
  useEffect(() => products.subscribe(reload), [products, reload]);
  return {
    rows: request.data?.data ?? [],
    loading: request.loading,
    failed: Boolean(request.error),
    reload,
  };
}
