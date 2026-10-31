import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

test.setTimeout(30000);
const appUrl = process.env.APP_URL;
test.skip(!appUrl, 'Set APP_URL to the real running application entry.');
const base = appUrl?.replace(/\/$/u, '') ?? '';
test.use({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
let session: Awaited<
  ReturnType<import('@playwright/test').APIRequestContext['storageState']>
>;

test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext();
  const id = randomUUID().replaceAll('-', '').slice(0, 16);
  // Disposable account in this example's local database. No real user's credentials or role grants are used.
  const password = randomUUID();
  const response = await request.post(`${base}/api/auth/sign-up/email`, {
    headers: { Origin: new URL(base).origin },
    data: {
      name: 'Layout Reader',
      username: `layout${id}`,
      email: `layout-${id}@example.com`,
      password,
    },
  });
  expect(response.status(), response.ok() ? '' : await response.text()).toBe(
    200,
  );
  const login = await request.post(`${base}/api/auth/sign-in/username`, {
    headers: { Origin: new URL(base).origin },
    data: { username: `layout${id}`, password },
  });
  expect(login.status()).toBe(200);
  session = await request.storageState();
  await request.dispose();
});
test.beforeEach(async ({ context, page }) => {
  await context.addCookies(session.cookies);
  await page.addInitScript(() =>
    localStorage.setItem('nocobase:main:theme:color-scheme', 'light'),
  );
});

async function capture(page: Page, name: string) {
  if (!process.env.SCREENSHOT_DIR) return;
  await mkdir(process.env.SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(process.env.SCREENSHOT_DIR, `${name}.png`),
    animations: 'disabled',
  });
}

test('catalog filters, wrapping, contained horizontal scrolling and sidebar preference', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/layouts`);
  await expect(
    page.getByRole('heading', { name: 'Product catalog', exact: true }),
  ).toBeVisible();
  await capture(page, 'catalog');
  await page
    .getByRole('textbox', { name: 'Search products' })
    .fill('missing-product');
  await expect(page.getByText('No matching products.')).toBeVisible();
  await capture(page, 'empty');
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('button', { name: 'Long heading' }).click();
  await capture(page, 'long-heading');
  await page
    .getByRole('button', { name: /^(Collapse|Expand|Open) navigation$/u })
    .first()
    .click();
  await capture(page, 'collapsed');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Product catalog', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Expand navigation', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(
    page.getByRole('textbox', { name: 'Search products' }),
  ).toBeVisible();
  const filter = await page
    .getByRole('complementary', { name: 'Product filters' })
    .boundingBox();
  const table = await page.getByRole('table').boundingBox();
  expect(table!.y).toBeGreaterThan(filter!.y + filter!.height);
  expect(
    await page
      .locator('html')
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  const scroller = page.locator('[data-slot=table-container]');
  expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
    true,
  );
  await capture(page, 'mobile');
  await page
    .getByRole('button', { name: /^(Collapse|Expand|Open) navigation$/u })
    .first()
    .click();
  await capture(page, 'mobile-navigation');
});

test('dialog and drawer keep filters, scroll and focus; direct entry and missing record', async ({
  page,
}) => {
  await page.goto(`${base}/layouts`);
  await page.getByRole('textbox', { name: 'Search products' }).fill('lamp');
  const trigger = page
    .getByRole('link', { name: 'Summary', exact: true })
    .nth(8);
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  const scroller = page.locator('main > div.overflow-y-auto');
  const before = await scroller.evaluate((el) => el.scrollTop);
  await trigger.click();
  await expect(
    page.getByRole('dialog', { name: 'Product summary' }),
  ).toBeVisible();
  await capture(page, 'dialog');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await scroller.evaluate((el) => el.scrollTop)).toBeCloseTo(before, 0);
  await expect(
    page.getByRole('textbox', { name: 'Search products' }),
  ).toHaveValue('lamp');
  await page
    .getByRole('link', { name: 'Arc desk lamp 01', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Product details' }),
  ).toBeVisible();
  await capture(page, 'drawer');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(`${base}/layouts/drawer/missing`);
  await expect(
    page.getByText('This sample product does not exist.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page).toHaveURL(`${base}/layouts`);
  await page.goto(`${base}/layouts/dialog/p1`);
  await page.reload();
  await expect(
    page.getByRole('dialog', { name: 'Product summary' }),
  ).toBeVisible();
});

test('covering page and inline tabs preserve parent scrolling and remain non-modal', async ({
  page,
}) => {
  await page.goto(`${base}/layouts`);
  const trigger = page
    .getByRole('link', { name: 'Details', exact: true })
    .nth(20);
  await trigger.scrollIntoViewIfNeeded();
  const scroller = page.locator('main > div.overflow-y-auto');
  const before = await scroller.evaluate((el) => el.scrollTop);
  await trigger.click();
  await expect(page).toHaveURL(/\/overview$/u);
  await expect(page.locator('[data-slot=route-child-page]')).toBeVisible();
  await capture(page, 'child-page');
  const main = await page.locator('main').boundingBox();
  const layer = await page
    .locator('[data-slot=route-child-page]')
    .boundingBox();
  expect(layer!.y).toBeCloseTo(main!.y, 0);
  expect(layer!.height).toBeCloseTo(main!.height, 0);
  const coveredInput = page.getByRole('textbox', { name: 'Search products' });
  expect(
    await coveredInput.evaluate((el) => el.closest('[inert]') !== null),
  ).toBe(true);
  await coveredInput.evaluate((el) => el.focus());
  await expect(coveredInput).not.toBeFocused();
  await page.getByRole('link', { name: 'Handling notes', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Handling notes' }),
  ).toBeVisible();
  await capture(page, 'inline-tabs');
  await page.goBack();
  await expect(page).toHaveURL(/\/overview$/u);
  await page.goForward();
  await expect(page).toHaveURL(/\/handling$/u);
  await page.reload();
  await expect(page).toHaveURL(/\/handling$/u);
  await page.getByRole('link', { name: 'Back to catalog' }).click();
  await expect(page).toHaveURL(`${base}/layouts`);
  // Reload reset the fixture state. Recheck retained scroll within one mounted visit.
  await trigger.scrollIntoViewIfNeeded();
  const current = await scroller.evaluate((el) => el.scrollTop);
  await trigger.click();
  await page.getByRole('link', { name: 'Back to catalog' }).click();
  expect(before).toBeGreaterThan(0);
  expect(await scroller.evaluate((el) => el.scrollTop)).toBeCloseTo(current, 0);
});

test('public standalone guide and real sign-in boundary', async ({
  page,
  browser,
}) => {
  await page.goto(`${base}/catalog-guide`);
  await expect(
    page.getByRole('heading', { name: 'Catalog guide' }),
  ).toBeVisible();
  await expect(page.locator('[data-slot=sidebar]')).toHaveCount(0);
  await capture(page, 'standalone');
  const guest = await browser.newContext({ locale: 'en-US' });
  const guestPage = await guest.newPage();
  await guestPage.goto(`${base}/catalog-guide`);
  await expect(
    guestPage.getByRole('heading', { name: 'Catalog guide' }),
  ).toBeVisible();
  await guestPage.getByRole('link', { name: 'Open product catalog' }).click();
  await expect(guestPage).toHaveURL(/\/login/u);
  await expect(
    guestPage.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible();
  await capture(guestPage, 'login');
  await guest.close();
});

test('drawer actions fit narrow and dark screens', async ({ page }) => {
  await page.goto(`${base}/layouts`);
  await page.getByRole('button', { name: 'Appearance' }).click();
  await page.getByText('Dark', { exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveClass(/dark/u);
  await capture(page, 'dark');
  await page.setViewportSize({ width: 375, height: 667 });
  await page
    .getByRole('link', { name: 'Arc desk lamp 01', exact: true })
    .click();
  const panel = page.getByRole('dialog', { name: 'Product details' });
  await expect(panel).toBeVisible();
  await expect(
    panel.getByRole('button', { name: 'Done', exact: true }),
  ).toBeInViewport();
  await expect
    .poll(async () => {
      const box = await panel.boundingBox();
      return Math.round(box!.x + box!.width);
    })
    .toBeLessThanOrEqual(375);
  expect((await panel.boundingBox())!.x).toBeGreaterThanOrEqual(0);
  await capture(page, 'drawer-mobile-dark');
});

test('default spacing preset and Chinese copy remain usable', async ({
  page,
}) => {
  await page.goto(`${base}/layouts`);
  await expect(
    page.getByRole('heading', { name: 'Product catalog', exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    localStorage.setItem('nocobase:main:theme:preset', 'default'),
  );
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'default');
  await capture(page, 'default-preset');
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page.getByRole('menuitem', { name: /Language/u }).click();
  await page.getByRole('menuitemradio', { name: /中文|Chinese/u }).click();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('heading', { name: '商品目录', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '长标题', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '季节性补货',
  );
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page
      .locator('html')
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
});
