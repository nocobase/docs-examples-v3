export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
}

// Fictional catalog data. Edits live in the page's React state only.
export const initialProducts: readonly Product[] = [
  {
    id: 'desk-lamp',
    name: 'Arc desk lamp',
    sku: 'LGT-104',
    price: 68,
    stock: 24,
  },
  {
    id: 'notebook',
    name: 'Linen notebook',
    sku: 'PPR-208',
    price: 18,
    stock: 8,
  },
  {
    id: 'bottle',
    name: 'Everyday bottle',
    sku: 'DRK-315',
    price: 32,
    stock: 46,
  },
  {
    id: 'organizer',
    name: 'Oak desk organizer',
    sku: 'DSK-402',
    price: 45,
    stock: 0,
  },
];

export interface ProductsContext {
  products: readonly Product[];
  saveProduct: (product: Product) => void;
}
