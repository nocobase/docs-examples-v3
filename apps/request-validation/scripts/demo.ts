import assert from 'node:assert/strict';
import { ApiClientError } from '@nocobase/api-client';
import type { OrderView } from '../server/orders/service.js';
import { demoSession } from './session.js';
import { errorSummary } from './client-errors.js';

const { api, ids, baseURL, headers } = await demoSession();
const reader = await demoSession('reader');
const draftPath = `orders/${ids.draft}`;
const before = await api.request({ path: draftPath });
async function rejected(
  label: string,
  run: () => Promise<unknown>,
  status: number,
  reason: string,
) {
  try {
    await run();
    assert.fail(`${label} must fail`);
  } catch (error) {
    assert(error instanceof ApiClientError);
    assert.equal(error.status, status);
    assert.equal(error.reason, reason);
    console.log(JSON.stringify({ scenario: label, ...errorSummary(error) }));
  }
}
console.log(
  JSON.stringify(await api.request({ path: 'orders?page=1&pageSize=1' })),
);
await rejected(
  'Invalid page',
  () => api.request({ path: 'orders?page=-1' }),
  400,
  'INVALID_INPUT',
);
await rejected(
  'Invalid ID',
  () => api.request({ path: 'orders/not-a-uuid' }),
  400,
  'INVALID_INPUT',
);
await rejected(
  'Unknown field',
  () =>
    api.request({
      method: 'PATCH',
      path: draftPath,
      json: { status: 'confirmed' },
    }),
  400,
  'INVALID_INPUT',
);
await rejected(
  'Nested field',
  () =>
    api.request({
      method: 'PATCH',
      path: draftPath,
      json: { items: [{ name: 'Keyboard', quantity: 0 }] },
    }),
  400,
  'INVALID_INPUT',
);
await rejected(
  'Missing customer',
  () =>
    api.request({
      method: 'PATCH',
      path: draftPath,
      json: { customerId: ids.missing, note: 'Must not be saved' },
    }),
  400,
  'CUSTOMER_UNAVAILABLE',
);
await rejected(
  'Missing order',
  () => api.request({ path: `orders/${ids.missing}` }),
  404,
  'ORDER_NOT_FOUND',
);
await rejected(
  'Confirmed order',
  () =>
    api.request({
      method: 'PATCH',
      path: `orders/${ids.confirmed}`,
      json: { note: 'Must not be saved' },
    }),
  400,
  'ORDER_LOCKED',
);
await rejected(
  'Permission before validation',
  () =>
    reader.api.request({
      method: 'PATCH',
      path: 'orders/not-a-uuid',
      json: { status: 'confirmed' },
    }),
  403,
  'ORDER_ACTION_DENIED',
);
assert.deepEqual(await api.request({ path: draftPath }), before);
const malformed = await fetch(`${baseURL}/orders`, {
  method: 'POST',
  headers: { ...headers, 'content-type': 'application/json' },
  body: '{',
});
assert.equal(malformed.status, 400);
console.log(
  JSON.stringify({
    scenario: 'Malformed JSON',
    status: malformed.status,
    body: await malformed.json(),
  }),
);
const created = await api.request<{ data: OrderView }>({
  method: 'POST',
  path: 'orders',
  json: {
    customerId: ids.customer,
    reference: '  SO-DEMO  ',
    items: [{ name: 'Keyboard', quantity: 1 }],
    note: 'Keep this note',
  },
});
assert.equal(created.data.reference, 'SO-DEMO');
const path = `orders/${created.data.id}`;
const preserved = await api.request<{ data: OrderView }>({
  method: 'PATCH',
  path,
  json: { reference: 'SO-DEMO-UPDATED' },
});
assert.equal(preserved.data.note, 'Keep this note');
const cleared = await api.request<{ data: OrderView }>({
  method: 'PATCH',
  path,
  json: { note: null },
});
assert.equal(cleared.data.note, null);
console.log(
  JSON.stringify({
    scenario: 'Create, preserve omitted note, clear with null',
    data: cleared.data,
  }),
);
console.log(
  'All HTTP scenarios passed; rejected edits left the fixture unchanged.',
);
