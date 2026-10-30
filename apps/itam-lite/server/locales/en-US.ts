import type { LocaleResource } from '@nocobase/i18n';

// The application's own server-side wording: in-app messages about device requests.
const enUS = {
  notifications: {
    approvalRequested: {
      title: '{{requestNo}} needs your approval',
      body: 'A device request is waiting for an asset manager.',
    },
    readyToIssue: {
      title: '{{requestNo}} is ready to issue',
      body: 'Choose an in-stock device and issue it to the requester.',
    },
    approved: {
      title: '{{requestNo}} was approved',
      body: 'IT support will issue your device.',
    },
    rejected: {
      title: '{{requestNo}} was rejected',
      body: 'Reason: {{comment}}',
    },
    issued: {
      title: '{{requestNo}}: your device was issued',
      body: 'It is now in the device register under your name.',
    },
  },
};

export type AppServerResource = LocaleResource<typeof enUS>;

export default enUS;
