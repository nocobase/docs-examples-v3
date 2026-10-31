export default {
  viewerRole: 'Customer viewer',
  editorRole: 'Customer editor',
  title: 'Customer directory',
  description:
    'Search and maintain fictional customer records. Changes are saved to the database.',
  name: 'Customer name',
  contact: 'Contact',
  email: 'Email',
  status: 'Status',
  active: 'Active',
  inactive: 'Inactive',
  all: 'All statuses',
  new: 'Add customer',
  edit: 'Edit customer',
  details: 'Customer details',
  save: 'Save customer',
  saving: 'Saving…',
  cancel: 'Cancel',
  delete: 'Delete customer',
  deleteTitle: 'Delete {{name}}?',
  deleteDescription:
    'This removes the customer from the database. The current search and sort order will be preserved.',
  refresh: 'Refresh',
  refreshing: 'Refreshing the current query…',
  count: '{{count}} customers',
  search: 'Search customers',
  searchPlaceholder: 'Customer name',
  searchAction: 'Search',
  rowActions: 'Actions for {{name}}',
  demoControls: 'Request demonstrations',
  readMode: 'Read behavior',
  demoHelp:
    'Requires CUSTOMER_DEMO_FAULTS=1 at startup. For out-of-order responses, search A and then Al quickly. Retry switches a failed read back to normal.',
  readModes: {
    normal: 'Normal response',
    slow: 'Slow response (1.6 seconds)',
    fail: 'Read failure',
    race: 'Out-of-order responses',
  },
  writeDemo: 'Submission demonstrations',
  writeMode: 'Next submission',
  writeModes: {
    normal: 'Normal submission',
    slow: 'Slow submission (1.6 seconds)',
    reject: 'Reject before saving',
    lose: 'Lose response after saving',
  },
  loading: 'Loading customer…',
  failed: 'The request failed. Check your connection and retry.',
  forbidden:
    'You no longer have access. Previous customer data has been cleared.',
  unauthenticated: 'Your session has ended. Sign in again.',
  missing: 'This customer no longer exists or is not accessible.',
  demoDisabled:
    'Restart the example with CUSTOMER_DEMO_FAULTS=1 to use fault demonstrations.',
  saveRejected:
    'This demonstration rejected the write before saving. Your draft is preserved; select Normal submission and try again.',
  invalid: 'Check the name, contact and email before saving again.',
  uncertain:
    'The result is unknown. Keep the original values and retry the same submission to recover its result.',
  unknownResult:
    'No reliable result was received. The customer may already have been saved.',
  recoverAfterReload:
    'A previous submission is unresolved. Enter its original values exactly, then retry. Changing the values cannot start a new operation.',
  uncertainDelete:
    'The deletion result is unknown. Retry the same deletion to recover its result.',
  retry: 'Retry',
  retryOriginal: 'Retry original submission',
  discardTitle: 'Discard unsaved changes?',
  discardDescription:
    'Your changes have not been submitted. Leave this form and discard them?',
  keepEditing: 'Keep editing',
  discard: 'Discard',
};
