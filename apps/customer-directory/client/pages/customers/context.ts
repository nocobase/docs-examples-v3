import { useOutletContext } from 'react-router';
export interface CustomerContext {
  reload: () => void;
}
export function useCustomerContext() {
  return useOutletContext<CustomerContext>();
}
