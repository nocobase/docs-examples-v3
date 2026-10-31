import fileUi from '../extensions/nocobase-file-component-ui/locales/zh-CN.js';
import type { AppResource } from './en-US.js';
import systemZhCN from './system/zh-CN.js';

const zhCN: AppResource = {
  // The template's own copy; see `./en-US.ts`.
  ...systemZhCN,
  ...fileUi,
  access: {
    clearSearch: 'Clear search',
    backToList: 'Back to list',
    searchCustomers: 'Search by customer name',
    searchOrders: 'Search by order number',
    title: 'Customer Access',
    customers: 'Customers',
    orders: 'Orders',
    viewCustomers: 'View customers',
    createCustomer: 'New customer',
    editCustomer: 'Edit customer',
    viewOrders: 'View orders',
    assignCustomer: 'Change customer',
    owned: 'Records I own',
    sales: 'Sales representative',
    reader: 'Read-only sales',
    name: 'Name',
    email: 'Email',
    notes: 'Notes',
    number: 'Order number',
    customerHint:
      'View the customers available to you. Edit contact details without changing ownership.',
    orderHint:
      'Choose an order to change its customer. Only customers permitted for this operation are available.',
    actions: 'Actions for {{name}}',
    refresh: 'Refresh',
    loading: 'Loading…',
    retry: 'Retry',
    signIn: 'Sign in to continue.',
    denied: 'You do not have permission for this operation.',
    unavailable: 'This record is unavailable.',
    invalid:
      'Check your input and make sure the selected customer is still available.',
    failed: 'The request could not be completed. Please try again.',
    saved: 'Changes saved',
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    editHint:
      'You can change the name, email and notes. Ownership is assigned by the server.',
    assignmentHint:
      'Choose a customer for order {{number}}. The order and customer must both be within your permitted records.',
    selectCustomer: 'Select customer',
    search: 'Search this page of customers',
    noCustomers: 'No available customers',
    previous: 'Previous',
    next: 'Next',
  },
};

export default zhCN;
