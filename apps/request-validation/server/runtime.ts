import { defineAppRuntime } from '@nocobase/app-server/runtime';
import { createAppConfig } from './config.js';
import defaultConfigs from './config/index.js';
import plugins from './plugins.js';
import serviceProviders from './providers/index.js';
import routes from './routes/index.js';
export default defineAppRuntime({
  deploymentRootDir: import.meta.filename.endsWith('.ts') ? '.' : '..',
  createAppConfig,
  defaultConfigs,
  plugins,
  serviceProviders,
  routes,
});
