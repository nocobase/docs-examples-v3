import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const appUrl = process.env.APP_URL;
test.skip(
  !appUrl,
  'Set APP_URL to the running NocoBase application entry, including its base path.',
);
const base = `${appUrl?.replace(/\/$/, '')}/ui-components`;
async function capture(page: Page, name: string) {
  const directory = process.env.SCREENSHOT_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, `${name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
}
test.setTimeout(30000);
test.use({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    () =>
      localStorage.getItem('nocobase:main:theme:color-scheme') ??
      localStorage.setItem('nocobase:main:theme:color-scheme', 'light'),
  );
});
test('catalog reuses components and filters sample products', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/catalog`);
  await expect(
    page.getByRole('link', { name: 'Arc desk lamp', exact: true }),
  ).toBeVisible();
  await capture(page, 'catalog');
  await page
    .getByRole('textbox', { name: 'Search products' })
    .fill('not-in-catalog');
  await expect(page.getByText('No matching products.')).toBeVisible();
  await capture(page, 'catalog-empty');
  expect(errors).toEqual([]);
});
test('edit protects close, validates, retains failed input and saves only in memory', async ({
  page,
}) => {
  await page.goto(`${base}/catalog?category=lighting`);
  await page.getByRole('link', { name: 'Arc desk lamp', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Edit product', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/catalog\/edit\/desk-lamp\?category=lighting$/);
  await capture(page, 'edit-product');
  const input = page.getByRole('textbox', { name: 'Product name' });
  await input.fill('Updated lamp');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await capture(page, 'discard-changes');
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(input).toHaveValue('Updated lamp');
  await input.fill('');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Enter a value.')).toBeVisible();
  await input.pressSequentially('Arc desk lamp v2');
  await page.getByRole('checkbox', { name: 'Simulate save failure' }).check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('dialog', { name: 'Edit product', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('simulated save failed');
  await expect(input).toHaveValue('Arc desk lamp v2');
  await capture(page, 'save-failure');
  await page.getByRole('checkbox', { name: 'Simulate save failure' }).uncheck();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Edit product', exact: true }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/catalog\?category=lighting$/);
  await expect(
    page.getByRole('link', { name: 'Arc desk lamp v2', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('link', { name: 'Arc desk lamp', exact: true }),
  ).toBeVisible();
});
test('history, unload, direct entry and missing product', async ({ page }) => {
  await page.goto(`${base}/catalog`);
  await page.getByRole('link', { name: 'Arc desk lamp', exact: true }).click();
  await page.getByRole('textbox', { name: 'Product name' }).fill('Draft lamp');
  await page.evaluate('history.back()');
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page).toHaveURL(/edit\/desk-lamp$/);
  const warning = page.waitForEvent('dialog');
  const reload = page.reload({ timeout: 3000 }).catch(() => undefined);
  const dialog = await warning;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.dismiss();
  await reload;
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(page).toHaveURL(/catalog$/);
  await page.goto(`${base}/catalog/edit/desk-lamp`);
  await expect(page.getByRole('textbox', { name: 'Product name' })).toHaveValue(
    'Arc desk lamp',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/catalog$/);
  await page.goto(`${base}/catalog/edit/missing`);
  await expect(
    page.getByText('This sample product does not exist.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save changes' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/catalog$/);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});
test('business block gets names, dates, data and action results from its caller', async ({
  page,
}) => {
  await page.goto(`${base}/review`);
  await expect(page.getByText('Avery Chen').first()).toBeVisible();
  await expect(page.getByText('Morgan Lee').first()).toBeVisible();
  await expect(page.getByText(/Jan 12, 2026.*UTC/).first()).toBeVisible();
  await capture(page, 'review-block');
  await page
    .getByRole('button', { name: 'Refuse the next note', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Add review note', exact: true })
    .click();
  const form = page.getByRole('form', { name: 'Add review note' });
  await form
    .getByRole('button', { name: 'Add review note', exact: true })
    .click();
  await expect(form.getByText('Enter a value.')).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Review note' })
    .fill('Please add a side photo.');
  await capture(page, 'review-note');
  await form
    .getByRole('button', { name: 'Add review note', exact: true })
    .click();
  await expect(
    form.getByRole('button', { name: 'Add review note', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('demo refused');
  await expect(page.getByRole('textbox', { name: 'Review note' })).toHaveValue(
    'Please add a side photo.',
  );
  await capture(page, 'review-refused');
  await form
    .getByRole('button', { name: 'Add review note', exact: true })
    .click();
  await expect(form).toHaveCount(0);
  await expect(page.getByText('Please add a side photo.')).toBeVisible();
  await capture(page, 'review-updated');
});
test('shared stock badge is reused in cards, including dark and narrow views', async ({
  page,
}) => {
  await page.goto(`${base}/customize`);
  await expect(page.getByText('Low stock', { exact: true })).toBeVisible();
  await capture(page, 'stock-variants');
  await page.getByRole('button', { name: 'Appearance' }).click();
  await page.getByText('Dark', { exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await capture(page, 'stock-variants-dark');
  await page.setViewportSize({ width: 375, height: 667 });
  expect(
    await page.evaluate(
      () =>
        (
          globalThis as unknown as {
            document: { documentElement: { scrollWidth: number } };
            innerWidth: number;
          }
        ).document.documentElement.scrollWidth <=
        (globalThis as unknown as { innerWidth: number }).innerWidth,
    ),
  ).toBe(true);
  await page.goto(`${base}/catalog/edit/desk-lamp`);
  await expect(
    page.getByRole('button', { name: 'Save changes' }),
  ).toBeInViewport();
  const panel = await page
    .getByRole('dialog', { name: 'Edit product', exact: true })
    .boundingBox();
  expect(panel!.x).toBeGreaterThanOrEqual(0);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(375);
  await capture(page, 'edit-mobile-dark');
});
