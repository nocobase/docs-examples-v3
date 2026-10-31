import type { ApiClient } from '@nocobase/app-client';

export interface Product {
  id: string;
  name: string;
  sku: string;
}
export type DemoMode = 'normal' | 'slow' | 'fail';
export interface RenameOptions {
  signal?: AbortSignal;
  mode?: DemoMode;
}

export class ProductsService {
  private revision = 0;
  private disposed = false;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly api: ApiClient) {}
  getSnapshot = (): number => this.revision;
  subscribe = (listener: () => void): (() => void) => {
    if (this.disposed) throw new Error('ProductsService has been disposed.');
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  async rename(
    id: string,
    name: string,
    options: RenameOptions = {},
  ): Promise<Product> {
    if (this.disposed) throw new Error('ProductsService has been disposed.');
    const response = await this.api.request<{ data: Product }>({
      method: 'PATCH',
      path: `clientServiceProducts/${encodeURIComponent(id)}`,
      json: { name },
      signal: options.signal,
      // This header controls this example's HTTP response, not a framework feature.
      headers: { 'x-demo-mode': options.mode ?? 'normal' },
    });
    if (!this.disposed) {
      this.revision += 1;
      for (const listener of this.listeners) listener();
    }
    return response.data;
  }
  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }
}
