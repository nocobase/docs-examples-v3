import { createApiClient, type ClientApplication } from '@nocobase/app-client';
import {
  ServiceContainer,
  createServiceToken,
} from '@nocobase/service-provider';
import { apiClientToken } from '@nocobase/app-client';
import { describe, expect, it, vi } from 'vitest';
import { ProductsService } from '../../client/services/products.js';
import { productsServiceToken } from '../../client/services/tokens.js';
import { ProductsServiceProvider } from '../../client/providers/products.js';

function fixture(
  fetcher: typeof fetch = async () =>
    Response.json({
      data: { id: 'lamp', name: 'Updated lamp', sku: 'LMP-001' },
    }),
) {
  const api = createApiClient({
    baseURL: 'http://example.test/api',
    fetch: fetcher,
  });
  const container = new ServiceContainer();
  container.instance(apiClientToken, api);
  const provider = new ProductsServiceProvider({
    container,
  } as ClientApplication);
  provider.register();
  return { container, provider };
}
describe('products client service', () => {
  it('uses lazy per-container instances and stable token identity', async () => {
    const { container, provider } = fixture();
    expect(container.resolveIfCreated(productsServiceToken)).toBeUndefined();
    await provider.shutdown();
    expect(container.resolveIfCreated(productsServiceToken)).toBeUndefined();
    const first = container.resolve(productsServiceToken);
    expect(container.resolve(productsServiceToken)).toBe(first);
    expect(fixture().container.resolve(productsServiceToken)).not.toBe(first);
    expect(() => container.resolve(createServiceToken('app.products'))).toThrow(
      'not registered',
    );
  });
  it('encodes IDs, sends JSON and notifies both subscribers after success', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        data: { id: 'lamp/one', name: 'New name', sku: 'LMP-001' },
      }),
    );
    const { container, provider } = fixture(fetcher);
    const service = container.resolve(productsServiceToken);
    const first = vi.fn(),
      second = vi.fn();
    const off = service.subscribe(first);
    service.subscribe(second);
    const result = await service.rename('lamp/one', 'New name');
    expect(result.name).toBe('New name');
    expect(String(fetcher.mock.calls[0][0])).toContain('lamp%2Fone');
    expect(fetcher.mock.calls[0][1]?.body).toBe(
      JSON.stringify({ name: 'New name' }),
    );
    expect(service.getSnapshot()).toBe(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    off();
    await service.rename('lamp/one', 'Next');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    await provider.shutdown();
    await expect(service.rename('lamp', 'After disposal')).rejects.toThrow(
      'disposed',
    );
    expect(() => service.subscribe(first)).toThrow('disposed');
  });
  it('does not announce failed or cancelled requests', async () => {
    const { container } = fixture(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          if (new Headers(init?.headers).get('x-demo-mode') === 'fail') {
            reject(new Error('failure'));
            return;
          }
          if (init?.signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
          }
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }),
    );
    const service = container.resolve(productsServiceToken);
    const listener = vi.fn();
    service.subscribe(listener);
    await expect(
      service.rename('lamp', 'Failed', { mode: 'fail' }),
    ).rejects.toThrow();
    const controller = new AbortController();
    const pending = service.rename('lamp', 'Cancelled', {
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(service.getSnapshot()).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });
  it('does not notify after disposal while a response is pending', async () => {
    let finish!: (value: Response) => void;
    const service = new ProductsService(
      createApiClient({
        baseURL: 'http://example.test/api',
        fetch: async () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      }),
    );
    const listener = vi.fn();
    service.subscribe(listener);
    const pending = service.rename('lamp', 'Late');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    service.dispose();
    finish(
      Response.json({ data: { id: 'lamp', name: 'Late', sku: 'LMP-001' } }),
    );
    await pending;
    expect(listener).not.toHaveBeenCalled();
    expect(service.getSnapshot()).toBe(0);
  });
});
