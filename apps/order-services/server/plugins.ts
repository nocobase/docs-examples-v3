import authentication from '@nocobase/app-plugin-authentication/server';
import authorization from '@nocobase/app-plugin-authorization/server';
import { defineServerPlugins } from '@nocobase/app-server/plugins';
export default defineServerPlugins([authentication, authorization]);
