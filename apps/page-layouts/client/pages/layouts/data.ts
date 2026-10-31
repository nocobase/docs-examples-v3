export interface Product {
  id: string;
  name: string;
  sku: string;
  category: 'lighting' | 'furniture';
  warehouse: string;
}

// Fictional, read-only fixtures. The number of rows deliberately makes the page scroll.
export const products: Product[] = Array.from({ length: 48 }, (_, index) => ({
  id: `p${index + 1}`,
  name: `${index % 2 === 0 ? 'Arc desk lamp' : 'Oak writing desk'} ${String(index + 1).padStart(2, '0')}`,
  sku: `NORTHSTAR-${String(index + 1).padStart(4, '0')}`,
  category: index % 2 === 0 ? 'lighting' : 'furniture',
  warehouse:
    index % 3 === 0 ? 'East distribution center' : 'West distribution center',
}));
