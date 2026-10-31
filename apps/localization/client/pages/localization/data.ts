export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  updatedAt: string;
}
export const products: readonly Product[] = [
  {
    id: 'lamp',
    name: 'Arc desk lamp',
    price: 1299.5,
    stock: 1250,
    updatedAt: '2026-10-15T14:30:00Z',
  },
  {
    id: 'chair',
    name: 'Oak dining chair',
    price: 249,
    stock: 24,
    updatedAt: '2026-10-16T09:00:00Z',
  },
  {
    id: 'shelf',
    name: 'Modular shelf',
    price: 189,
    stock: 0,
    updatedAt: '2026-10-17T16:45:00Z',
  },
];
export interface CatalogContext {
  products: readonly Product[];
  save: (id: string, name: string) => void;
}
