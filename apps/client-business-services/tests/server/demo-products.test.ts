import { apiErrorHandler } from '@nocobase/app-server/router';
import { describe, expect, it } from 'vitest';
import { createDemoProductsRouter } from '../../server/routes/demo-products.js';

describe('public disposable product API', () => {
  it('keeps application stores isolated and saves through HTTP', async () => {
    const router = createDemoProductsRouter().onError(apiErrorHandler);
    const response = await router.request('/clientServiceProducts/lamp', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'New lamp' }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).data.name).toBe('New lamp');
    expect(
      (await (await router.request('/clientServiceProducts')).json()).data[0]
        .name,
    ).toBe('New lamp');
    expect(
      (
        await (
          await createDemoProductsRouter().request('/clientServiceProducts')
        ).json()
      ).data[0].name,
    ).toBe('Arc desk lamp');
  });
  it('rejects invalid names and fixed record IDs without changing data', async () => {
    const router = createDemoProductsRouter().onError(apiErrorHandler);
    for (const [id, name] of [
      ['lamp', ''],
      ['unknown', 'Name'],
    ]) {
      const response = await router.request(`/clientServiceProducts/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      expect(response.status).toBe(400);
    }
    expect(
      (await (await router.request('/clientServiceProducts')).json()).data[0]
        .name,
    ).toBe('Arc desk lamp');
  });
});
