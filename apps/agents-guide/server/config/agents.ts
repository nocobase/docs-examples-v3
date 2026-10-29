import { defineAppConfig } from '@nocobase/app-server/config';

/** Match package.json's nocobase.cli.bin so Runner tasks download the served application CLI. */
export default defineAppConfig(() => ({
  cli: { name: 'agents-guide', package: { kind: 'served' as const } },
}));
