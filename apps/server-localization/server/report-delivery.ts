import { defineServerPlugin } from "@nocobase/app-server/plugins";

/** A locale-only fixture registered as a real Server plugin; no npm package is required. */
export const reportDelivery = defineServerPlugin({
  packageName: "@example/report-delivery",
  baseDir: import.meta.dirname,
  locales: {
    "en-US": async () => ({
      default: {
        delivery: {
          ready: "Delivery ready: {{name}}.",
          channel: "Customer portal",
        },
      },
    }),
    "zh-CN": async () => ({
      default: {
        delivery: {
          ready: "已可交付：{{name}}。",
          channel: "客户门户",
        },
      },
    }),
    "ja-JP": async () => ({
      default: { delivery: { channel: "顧客ポータル" } },
    }),
  },
});
