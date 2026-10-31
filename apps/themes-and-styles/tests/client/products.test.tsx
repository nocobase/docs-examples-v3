import { renderWithApp } from '@nocobase/app-testing/client';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProductsPage from '../../client/pages/products/index.js';
import EditProductPage from '../../client/pages/products/edit.js';
import { AppThemeProvider } from '../../client/theme/theme-provider.js';
import enUS from '../../client/locales/en-US.js';

async function renderPage() {
  await renderWithApp(
    <AppThemeProvider>
      <Routes>
        <Route path='/products' element={<ProductsPage />}>
          <Route path='edit/:productId' element={<EditProductPage />} />
        </Route>
      </Routes>
    </AppThemeProvider>,
    {
      route: '/products',
      namespace: 'themes-and-styles',
      namespaces: { 'themes-and-styles': enUS },
    },
  );
}

describe('product theme demonstration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());
  it('changes each appearance setting without resetting the other', async () => {
    await renderPage();
    await userEvent.click(
      screen.getByRole('button', { name: 'Dark', exact: true }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Brand', exact: true }),
    );
    expect(
      screen.getByRole('button', { name: 'Dark', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.theme).toBe('brand');
    expect(localStorage.getItem('nocobase:main:theme:color-scheme')).toBe(
      'dark',
    );
    expect(localStorage.getItem('nocobase:main:theme:preset')).toBe('brand');
  });
  it('validates, saves in memory, and restores the demonstration data', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('link', { name: 'Arc desk lamp' }));
    const name = await screen.findByLabelText('Product', { exact: true });
    await userEvent.clear(name);
    await userEvent.click(
      screen.getByRole('button', { name: 'Save', exact: true }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a product name.',
    );
    expect(name).toHaveFocus();
    await userEvent.type(name, 'Updated lamp');
    await userEvent.click(
      screen.getByRole('button', { name: 'Save', exact: true }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('link', { name: 'Updated lamp' }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset products' }),
    );
    expect(
      screen.getByRole('link', { name: 'Arc desk lamp' }),
    ).toBeInTheDocument();
  });
});
