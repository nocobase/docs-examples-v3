import { ApiClientError } from '@nocobase/api-client';
import type { ApiRequestMethod } from '@nocobase/api-client';
import { demoSession } from './session.js';

// Example: pnpm request PATCH orders/<id> '{"note":null}'
const [method = 'GET', path = 'orders', json] = process.argv.slice(2);
const { api } = await demoSession(
  process.env.DEMO_ROLE === 'reader' ? 'reader' : 'editor',
);
try {
  console.log(
    JSON.stringify(
      await api.request({
        method: method as ApiRequestMethod,
        path,
        ...(json === undefined ? {} : { json: JSON.parse(json) }),
      }),
      null,
      2,
    ),
  );
} catch (error) {
  if (!(error instanceof ApiClientError)) throw error;
  console.log(JSON.stringify(error.payload, null, 2));
  process.exitCode = 1;
}
