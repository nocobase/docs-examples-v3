import { createContext, useContext, useEffect } from 'react';
import type { Customer } from './types.js';
export const CustomersContext = createContext<{
  changed: (customer: Customer, created?: boolean) => void;
  removed: (id: string, committed?: boolean) => void;
  reload: () => void;
  customers: Customer[];
  updates: Record<string, Customer>;
  search: string;
  refreshVersion: number;
  missingIds: string[];
}>({
  changed: () => {},
  removed: () => {},
  reload: () => {},
  customers: [],
  updates: {},
  search: '',
  refreshVersion: 0,
  missingIds: [],
});
export const useCustomers = () => useContext(CustomersContext);
export function focusCustomerSearch() {
  requestAnimationFrame(() =>
    document.getElementById('customer-search')?.focus(),
  );
}

/** Route overlays can unmount through Escape, X, Back or an outside click. */
export function useCustomerOverlayFocus() {
  useEffect(() => {
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    return () => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const panel = document.querySelector<HTMLElement>(
            '[data-slot="route-overlay-content"]',
          );
          if (
            trigger?.isConnected &&
            trigger !== document.body &&
            (!panel || panel.contains(trigger))
          )
            trigger.focus();
          else if (panel) panel.focus();
          else document.getElementById('customer-search')?.focus();
        }),
      );
    };
  }, []);
}
