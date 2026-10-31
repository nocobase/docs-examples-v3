import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const appUrl = process.env.APP_URL;
test.skip(!appUrl, 'Set APP_URL to the running application entry.');
const base = appUrl?.replace(/\/$/, '');
const expectedDefault = process.env.EXPECTED_DEFAULT ?? 'en-US';
test.use({ viewport: { width: 1280, height: 850 }, locale: 'zh-CN' });
async function capture(page: Page, name: string) {
  if (!process.env.SCREENSHOT_DIR) return;
  await mkdir(process.env.SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(process.env.SCREENSHOT_DIR, `${name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
}
async function languageMenu(page: Page) {
  await page.getByRole('button', { name: /^(Language|语言|言語)$/ }).click();
  await page.getByRole('menuitem', { name: /Language|语言|言語/ }).hover();
  await expect(
    page.getByRole('menuitemradio', { name: '日本語', exact: true }),
  ).toBeVisible();
}
async function choose(page: Page, label: string, locale: string) {
  await languageMenu(page);
  const sync = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/i18n/locale') &&
      response.request().method() === 'PUT',
  );
  await page.getByRole('menuitemradio', { name: label, exact: true }).click();
  expect((await sync).ok()).toBe(true);
  expect((await (await sync).json()).data).toMatchObject({
    locale,
    requestedLocale: locale,
    fallback: false,
  });
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
}
test('defaults respect config rather than browser language and preserve an explicit choice', async ({
  page,
}) => {
  await page.goto(`${base}/localization`);
  await expect(page.locator('html')).toHaveAttribute('lang', expectedDefault);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        key.startsWith('nocobase.locale:'),
      ),
    ),
  ).toEqual([]);
  await choose(page, '日本語', 'ja-JP');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja-JP');
  await expect(page.getByTestId('shipping')).toHaveText(
    expectedDefault === 'zh-CN'
      ? '两个工作日内发货。'
      : 'Ships within two business days.',
  );
});
test('catalog, quantities, translated feedback and in-memory save', async ({
  page,
}) => {
  test.skip(expectedDefault !== 'en-US');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/localization`);
  await expect(page.getByText('3 products', { exact: true })).toBeVisible();
  await expect(page.getByText('$1,299.50')).toBeVisible();
  await expect(page.getByTestId('plugin-label')).toHaveText('Store language');
  await capture(page, 'catalog');
  const search = page.getByRole('textbox', { name: 'Search products' });
  await search.pressSequentially('Arc');
  await expect(page.getByText('1 product', { exact: true })).toBeVisible();
  await capture(page, 'singular');
  await search.fill('missing');
  await expect(page.getByText('0 products', { exact: true })).toBeVisible();
  await expect(page.getByText('No matching products.')).toBeVisible();
  await capture(page, 'empty');
  await search.fill('');
  await page.getByRole('link', { name: 'Arc desk lamp', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Product name' });
  await input.fill('');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Enter a product name.');
  await capture(page, 'validation');
  await input.pressSequentially('Updated lamp');
  await page.getByRole('checkbox', { name: 'Simulate save failure' }).check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('simulated save failed');
  await expect(input).toHaveValue('Updated lamp');
  await capture(page, 'failure');
  await page.getByRole('checkbox', { name: 'Simulate save failure' }).uncheck();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Edit product', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('Saved “Updated lamp”.')).toBeVisible();
  await capture(page, 'saved');
  await page.reload();
  await expect(
    page.getByRole('link', { name: 'Arc desk lamp', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('switches mounted text, formats and overrides without changing product data', async ({
  page,
}) => {
  test.skip(expectedDefault !== 'en-US');
  await page.goto(`${base}/localization`);
  await languageMenu(page);
  await capture(page, 'languages');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await choose(page, '中文', 'zh-CN');
  await expect(page.getByRole('heading', { name: '商品目录' })).toBeVisible();
  await expect(page.getByText('3 件商品', { exact: true })).toBeVisible();
  await expect(page.getByTestId('plugin-label')).toHaveText('商店语言');
  await page.getByRole('link', { name: 'Arc desk lamp', exact: true }).click();
  await page.getByRole('textbox', { name: '商品名称' }).fill('');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('请输入商品名称。');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await choose(page, '日本語', 'ja-JP');
  await expect(
    page.getByRole('heading', { name: '商品カタログ' }),
  ).toBeVisible();
  await expect(page.getByTestId('shipping')).toHaveText(
    'Ships within two business days.',
  );
  await expect(page.getByTestId('plugin-label')).toHaveText('ストアの言語');
  await expect(
    page.getByRole('link', { name: 'Arc desk lamp', exact: true }),
  ).toBeVisible();
});
test('mobile dialog, direct entry and dark theme', async ({ page }) => {
  test.skip(expectedDefault !== 'en-US');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${base}/localization/edit/lamp`);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  await expect(
    page.getByRole('button', { name: 'Save', exact: true }),
  ).toBeInViewport();
  await capture(page, 'mobile');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.evaluate("document.documentElement.classList.add('dark')");
  await capture(page, 'dark');
});
