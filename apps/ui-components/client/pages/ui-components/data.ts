export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
}
// Fictional UI fixtures. The demo never reads or writes business records.
export const initialProducts: readonly Product[] = [
  {
    id: 'desk-lamp',
    name: 'Arc desk lamp',
    sku: 'LMP-101',
    category: 'Lighting',
    stock: 24,
  },
  {
    id: 'oak-tray',
    name: 'Oak desk tray',
    sku: 'ORG-204',
    category: 'Accessories',
    stock: 3,
  },
  {
    id: 'linen-notebook',
    name: 'Linen notebook',
    sku: 'STN-302',
    category: 'Stationery',
    stock: 0,
  },
];
export const people: Readonly<Record<string, string>> = {
  'person-1': 'Avery Chen',
  'person-2': 'Morgan Lee',
};
