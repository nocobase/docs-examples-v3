import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { renderWithApp, answerApi } from '@nocobase/app-testing/client';
import i18n from '@nocobase/app-plugin-i18n/client';
import {
  createTestI18nRuntime,
  MissingTranslationError,
} from '@nocobase/i18n/testing';
import { createAppI18nRuntime, writeStoredLocale } from '@nocobase/app-client';
import locales from '../../client/locales/index.js';
import CatalogPage from '../../client/pages/localization/index.js';
import EditProductPage from '../../client/pages/localization/edit.js';
import { productFormatters } from '../../client/pages/localization/format.js';
import { products } from '../../client/pages/localization/data.js';
const application = { namespace: 'localization', resources: locales };

describe('real localization resources', () => {
  it.each(['en-US', 'zh-CN', 'ja-JP'])(
    'translates counts and interpolation in %s',
    async (locale) => {
      const runtime = await createTestI18nRuntime({ application, locale });
      const t = runtime.getFixedT('localization', locale);
      const expected =
        locale === 'en-US'
          ? ['0 products', '1 product', '2 products']
          : locale === 'zh-CN'
            ? ['0 件商品', '1 件商品', '2 件商品']
            : ['商品 0 件', '商品 1 件', '商品 2 件'];
      expect([0, 1, 2].map((count) => t('catalog.count', { count }))).toEqual(
        expected,
      );
      expect(t('catalog.saved', { name: 'Arc' })).toContain('Arc');
      expect(() => t('catalog.titel')).toThrow(MissingTranslationError);
    },
  );
  it('falls back to the configured language, then English, and detects unknown keys', async () => {
    const runtime = await createTestI18nRuntime({
      application,
      locale: 'ja-JP',
      defaultLocale: 'zh-CN',
    });
    expect(runtime.getFixedT('localization', 'ja-JP')('catalog.shipping')).toBe(
      '两个工作日内发货。',
    );
    // Declare the isolated namespace before init, just as the host does.
    const fallbackRuntime = await createTestI18nRuntime({
      application,
      locale: 'ja-JP',
      defaultLocale: 'zh-CN',
      namespaces: {
        'fallback-fixture': {
          'en-US': async () => ({ onlyEnglish: 'Available in English' }),
          'zh-CN': async () => ({}),
          'ja-JP': async () => ({}),
        },
      },
    });
    expect(
      fallbackRuntime.getFixedT('fallback-fixture', 'ja-JP')('onlyEnglish'),
    ).toBe('Available in English');
  });
  it('default initialization does not create a preference; explicit choices survive a new default', async () => {
    localStorage.clear();
    const contributions = [
      { packageName: 'localization', source: 'application' as const, locales },
    ];
    const initial = await createAppI18nRuntime({
      contributions,
      defaultLocale: 'zh-CN',
    });
    expect(initial.getLocale()).toBe('zh-CN');
    expect(localStorage.length).toBe(0);
    writeStoredLocale('ja-JP');
    const next = await createAppI18nRuntime({
      contributions,
      defaultLocale: 'en-US',
    });
    expect(next.getLocale()).toBe('ja-JP');
    localStorage.clear();
  });
  it('formats without changing product values, currency or time zone', () => {
    const before = JSON.stringify(products);
    expect(productFormatters('en-US').money.format(products[0].price)).toBe(
      '$1,299.50',
    );
    expect(productFormatters('ja-JP').money.resolvedOptions().currency).toBe(
      'USD',
    );
    expect(productFormatters('zh-CN').date.resolvedOptions().timeZone).toBe(
      'UTC',
    );
    expect(JSON.stringify(products)).toBe(before);
  });
  it('renders and validates the real catalog with real translations', async () => {
    const user = userEvent.setup();
    await renderWithApp(
      <Routes>
        <Route path='/localization' element={<CatalogPage />}>
          <Route path='edit/:productId' element={<EditProductPage />} />
        </Route>
      </Routes>,
      {
        route: '/localization',
        namespace: 'localization',
        namespaces: { localization: locales },
        plugins: [i18n()],
        fetch: answerApi(({ path }) =>
          path === 'i18n/locale'
            ? {
                data: {
                  locale: 'en-US',
                  requestedLocale: 'en-US',
                  fallback: false,
                },
              }
            : new Response(null, { status: 404 }),
        ),
      },
    );
    expect(await screen.findByText('3 products')).toBeInTheDocument();
    expect(screen.getByTestId('plugin-label')).toHaveTextContent(
      'Store language',
    );
    await user.click(screen.getByRole('link', { name: 'Arc desk lamp' }));
    await user.clear(screen.getByRole('textbox', { name: 'Product name' }));
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a product name.',
    );
  });
});
