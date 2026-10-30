import { requestsZh, rolesZh, workflowsZh } from './requests.js';
import { devicesZh } from './devices.js';
import fileUi from '../extensions/nocobase-file-component-ui/locales/zh-CN.js';
import type { AppResource } from './en-US.js';
import systemZhCN from './system/zh-CN.js';

const zhCN: AppResource = {
  // The template's own copy; see `./en-US.ts`.
  ...systemZhCN,
  ...fileUi,
  devices: devicesZh,
  requests: requestsZh,
  roles: rolesZh,
  workflows: workflowsZh,
};

export default zhCN;
