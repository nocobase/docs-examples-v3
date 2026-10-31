import type { AppServerResource } from "./en-US.js";

const zhCN = {
  reports: {
    ready: "报表 {{name}} 已准备好。",
    subject: "你的报表：{{name}}",
    notReady: "报表 {{name}} 尚未准备好。",
  },
  overrides: {
    "@example/report-delivery": {
      delivery: { ready: "报表 {{name}} 已可在客户门户中查看。" },
    },
  },
} satisfies AppServerResource;
export default zhCN;
