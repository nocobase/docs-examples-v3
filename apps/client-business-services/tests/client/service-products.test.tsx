import { renderWithApp, answerApi } from '@nocobase/app-testing/client';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ProductsPage from '../../client/pages/service-products/index.js';
import { ProductsServiceProvider } from '../../client/providers/products.js';
import enUS from '../../client/locales/en-US.js';

describe('service product page', () => {
  it('shares successful changes, cleans up a hidden view, and preserves failed drafts', async () => {
    let name = 'Arc desk lamp';
    let fail = false;
    await renderWithApp(<ProductsPage />, {
      namespace: 'client-business-services',
      namespaces: { 'client-business-services': enUS },
      services: (app) => new ProductsServiceProvider(app).register(),
      fetch: answerApi(({ method, json }) => {
        if (method === 'PATCH') {
          if (fail) return new Response(null, { status: 503 });
          name = (json as { name: string }).name;
        }
        return {
          data:
            method === 'PATCH'
              ? { id: 'lamp', sku: 'LMP-001', name }
              : [{ id: 'lamp', sku: 'LMP-001', name }],
        };
      }),
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit Arc desk lamp' }),
    );
    const input = screen.getByLabelText('Product name');
    await userEvent.clear(input);
    await userEvent.type(input, 'Studio lamp');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(screen.getAllByText('Successful changes: 1')).toHaveLength(2),
    );
    expect(
      await screen.findByRole('button', { name: 'Edit Studio lamp' }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Hide second view' }),
    );
    fail = true;
    await userEvent.clear(input);
    await userEvent.type(input, 'Unsaved draft');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save',
    );
    expect(input).toHaveValue('Unsaved draft');
    expect(screen.getAllByText('Successful changes: 1')).toHaveLength(1);
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Successful changes: 2');
    await userEvent.click(
      screen.getByRole('button', { name: 'Show second view' }),
    );
    expect(screen.getAllByText('Successful changes: 2')).toHaveLength(2);
  });
  it('holds the submit lock during a request and cancels without a success notification', async () => {
    let finish!: (value: Response) => void;
    let writes = 0;
    const result = await renderWithApp(<ProductsPage />, {
      namespace: 'client-business-services',
      namespaces: { 'client-business-services': enUS },
      services: (app) => new ProductsServiceProvider(app).register(),
      fetch: async (request) => {
        if (request.method === 'PATCH') {
          writes++;
          return new Promise<Response>((resolve, reject) => {
            finish = resolve;
            request.signal.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true },
            );
          });
        }
        return Response.json({
          data: [{ id: 'lamp', sku: 'LMP-001', name: 'Arc desk lamp' }],
        });
      },
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit Arc desk lamp' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByLabelText('Product name')).toBeDisabled();
    expect(writes).toBe(1);
    await userEvent.click(
      screen.getByRole('button', { name: 'Cancel request' }),
    );
    expect(await screen.findByText(/Request cancelled/)).toBeInTheDocument();
    expect(screen.getAllByText('Successful changes: 0')).toHaveLength(2);
    await act(async () =>
      finish(
        Response.json({ data: { id: 'lamp', name: 'Late', sku: 'LMP-001' } }),
      ),
    );
    result.unmount();
  });
});
