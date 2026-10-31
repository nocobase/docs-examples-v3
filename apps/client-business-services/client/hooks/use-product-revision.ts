import { useService } from '@nocobase/app-client';
import { useSyncExternalStore } from 'react';
import { productsServiceToken } from '../services/tokens.js';
export function useProductRevision(): number {
  const products = useService(productsServiceToken);
  return useSyncExternalStore(products.subscribe, products.getSnapshot);
}
