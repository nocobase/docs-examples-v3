import { DemoContext } from './demo-context.js';
import { useState, type ReactNode } from 'react';
import { initialProducts } from './data.js';
export function CatalogDemoProvider({ children }: { children?: ReactNode }) {
  const [products, setProducts] = useState(initialProducts);
  return (
    <DemoContext.Provider
      value={{
        products,
        rename: (id, name) =>
          setProducts((items) =>
            items.map((p) => (p.id === id ? { ...p, name } : p)),
          ),
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
