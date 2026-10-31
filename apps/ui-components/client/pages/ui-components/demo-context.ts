import { createContext, useContext } from 'react';
import type { Product } from './data.js';
export const DemoContext = createContext<{
  products: readonly Product[];
  rename: (id: string, name: string) => void;
} | null>(null);
export function useCatalogDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error('CatalogDemoProvider is required');
  return value;
}
