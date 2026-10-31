import {
  defaultAppConfigs,
  defineAppConfig,
} from '@nocobase/app-server/config';
import { defineAuthConfig } from '@nocobase/app-plugin-authentication/server';
import { username } from 'better-auth/plugins';
import app from './app.js';
import snowflake from './snowflake.js';
import database from './database.js';
import server from './server.js';
import i18n from './i18n.js';
import logging from './logging.js';
import secrets from './secrets.js';
import caching from './caching.js';
import jobs from './jobs.js';
import api from './api.js';
import session from './session.js';
export default defaultAppConfigs({
  snowflake,
  app,
  database,
  server,
  i18n,
  logging,
  secrets,
  caching,
  jobs,
  api,
  session,
  auth: defineAuthConfig({
    defaults: {
      plugins: [username({ displayUsername: false })],
      emailAndPassword: { enabled: true, disableSignUp: true },
      session: { storeSessionInDatabase: true },
    },
  }),
  authorization: defineAppConfig(() => ({
    permissionSets: { rootSet: 'root', defaultSet: 'member' },
  })),
});
