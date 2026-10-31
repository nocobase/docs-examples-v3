import type { AppConfigFactory } from '@nocobase/app-server/config';
import { defineApiConfig, type ApiConfig } from '@nocobase/app-server/router';

// Optional global limits for API requests.
const api: AppConfigFactory<ApiConfig> = defineApiConfig();

export default api;
