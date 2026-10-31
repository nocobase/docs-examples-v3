import approvalUi from '../extensions/nocobase-approval-ui/locales/en-US.js';
import fileUi from '../extensions/nocobase-file-component-ui/locales/en-US.js';
import type { LocaleResource } from '@nocobase/i18n';

import systemEnUS from './system/en-US.js';

const enUS = {
  // The template's own copy: the shell, the sign-in pages, shared components and the homepage. Keep it in
  // `./system/` so a template upgrade can replace it without touching the application's copy below.
  ...systemEnUS,
  ...fileUi,
  ...approvalUi,
  catalog: {
    demoNav: 'UI examples',
    tabs: {
      catalog: 'Product catalog',
      review: 'Review block',
      customize: 'Component variants',
    },
    title: 'Product catalog',
    description:
      'Explore the components with sample products. Edits last until you reload the page.',
    search: 'Search products…',
    noResults: 'No matching products.',
    name: 'Product name',
    category: 'Category',
    availability: 'Availability',
    rowActions: 'Actions for {{name}}',
    edit: 'Edit',
    editTitle: 'Edit product',
    editDescription:
      'Change the name in this UI demo. No business record is saved.',
    cancel: 'Cancel',
    save: 'Save changes',
    saving: 'Saving…',
    saved: 'Product name updated for this session.',
    missing: 'This sample product does not exist.',
    required: 'Enter a value.',
    failSave: 'Simulate save failure',
    failureHint: 'Use this demo control to try an unsuccessful save and retry.',
    saveFailed:
      'The simulated save failed. Your changes are still here. Turn off the failure control and try again.',
    discardTitle: 'Discard changes?',
    discardDescription: 'Your unsaved product name will be lost.',
    keepEditing: 'Keep editing',
    discard: 'Discard',
    stock: {
      out: 'Out of stock',
      low: 'Low stock',
      available: 'In stock',
    },
    review: {
      title: 'Product review',
      description:
        'A presentation-only review of Arc desk lamp, with sample people and history. No approval process is executed.',
      submitted: 'Product information submitted',
      contentReview: 'Content review',
      waiting: 'Waiting for review',
      initialNote: 'Product photos and specifications are ready.',
      noteAdded: 'added a note',
      addNote: 'Add review note',
      note: 'Review note',
      refused:
        'The demo refused this note. Your input is preserved; submit again to retry.',
      reset: 'Reset example',
      progress: 'Review progress',
      history: 'Review history',
      actions: 'Review notes',
      failNext: 'Refuse the next note',
      failureReady: 'The next note will be refused',
    },
    custom: {
      title: 'Stock badge variants',
      description:
        'The same business component appears in the product table and these cards.',
      units: '{{count}} units in stock',
      units_one: '{{count}} unit in stock',
      units_other: '{{count}} units in stock',
    },
  },
  // The application's copy goes here, one group per feature. A shared group such as `navigation` is extended by
  // spreading the system one first, `navigation: { ...systemEnUS.navigation, orders: 'Orders' }`, since a group
  // written here replaces the system group of the same name rather than merging with it.
};

/**
 * The shape every locale of this application follows, derived from the English wording above.
 *
 * Anything a plugin does not translate falls back to this namespace, so a term defined here is reused everywhere
 * without each plugin repeating it.
 */
export type AppResource = LocaleResource<typeof enUS>;

export default enUS;
