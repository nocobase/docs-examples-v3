import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const base = process.env.APP_URL?.replace(/\/$/, '');
const screenshots = process.env.SCREENSHOT_DIR;
test.use({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
test.skip(!base, 'APP_URL must identify a running dedicated example instance.');
test('public HTML, mounted redirect and protected download', async ({
  page,
}) => {
  await page.goto(`${base}/catalog`);
  await expect(
    page.getByRole('heading', { name: 'Find your next everyday essential' }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Canvas Backpack', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Travel Mug', exact: true }),
  ).toHaveCount(0);
  if (screenshots) {
    await mkdir(screenshots, { recursive: true });
    await page.screenshot({
      path: path.join(screenshots, 'catalog-web.png'),
      fullPage: false,
    });
  }
  await page.goto(`${base}/old-catalog`);
  expect(page.url()).toBe(`${base}/catalog`);
  expect((await page.request.get(`${base}/catalog/export.csv`)).status()).toBe(
    401,
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole('link', { name: 'Download CSV' })).toBeVisible();
  expect(
    await page.evaluate(
      'document.documentElement.scrollWidth <= window.innerWidth',
    ),
  ).toBe(true);
});
test('session login, live API document and CSV download', async ({ page }) => {
  test.skip(
    !process.env.E2E_USERNAME || !process.env.E2E_PASSWORD,
    'Set credentials for this dedicated example.',
  );
  const response = await page.request.post(
    `${base}/api/auth/sign-in/username`,
    {
      headers: { Origin: new URL(base!).origin },
      data: {
        username: process.env.E2E_USERNAME,
        password: process.env.E2E_PASSWORD,
      },
    },
  );
  expect(response.status()).toBe(200);
  const schema = await page.request.get(`${base}/api/swagger`);
  expect(schema.status()).toBe(200);
  expect(JSON.stringify(await schema.json())).toContain('publishProduct');
  await page.goto(`${base}/api/swagger/docs#/Products`);
  const products = page.getByRole('heading', { name: /^Products / });
  await expect(products).toBeVisible({ timeout: 15000 });
  await products.scrollIntoViewIfNeeded();
  if (screenshots) {
    await mkdir(screenshots, { recursive: true });
    await page.screenshot({
      path: path.join(screenshots, 'catalog-api.png'),
      fullPage: false,
    });
  }
  await page.goto(`${base}/catalog`);
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('products.csv');
  const csvResponse = await page.request.get(`${base}/catalog/export.csv`);
  expect(await csvResponse.text()).toContain('Travel Mug');
  await page.goto(`${base}/settings/users`);
  await expect(
    page.getByRole('heading', { name: 'Users', exact: true }),
  ).toBeVisible();
});
