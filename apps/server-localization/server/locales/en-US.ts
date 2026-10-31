import type { LocaleResource } from "@nocobase/i18n";

const enUS = {
  reports: {
    ready: "Report {{name}} is ready.",
    subject: "Your report: {{name}}",
    notReady: "Report {{name}} is not ready yet.",
  },
  overrides: {
    "@example/report-delivery": {
      delivery: {
        ready: "Your report {{name}} is available in the customer portal.",
      },
    },
  },
};
export type AppServerResource = LocaleResource<typeof enUS>;
export default enUS;
