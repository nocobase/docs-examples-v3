import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.DEMO_URL;
test.skip(
  !base,
  'Set DEMO_URL to the running application base URL, including its mount path.',
);
test.use({
  viewport: { width: 1440, height: 1000 },
  launchOptions: {
    executablePath: process.env.CHROMIUM_PATH,
    args: process.env.CHROMIUM_PATH ? ['--no-sandbox'] : [],
  },
});

test('shared views, failed drafts, cancellation, remount and reload', async ({
  page,
  request,
}) => {
  const output = resolve(process.env.SCREENSHOT_DIR ?? 'storage/screenshots');
  await mkdir(output, { recursive: true });
  await request.patch(`${base}/api/clientServiceProducts/lamp`, {
    data: { name: 'Arc desk lamp' },
  });
  await page.goto(`${base}/service-products`);
  await page.getByRole('button', { name: 'Edit Arc desk lamp' }).click();
  const input = page.getByLabel('Product name', { exact: true });
  await expect(input).toHaveValue('Arc desk lamp');
  await page.screenshot({ path: `${output}/initial.png`, fullPage: false });
  await input.fill('Studio desk lamp');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(
    page.getByText('Successful changes: 1', { exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByRole('button', { name: 'Edit Studio desk lamp' }),
  ).toBeVisible();
  await page.screenshot({ path: `${output}/saved.png`, fullPage: false });
  await page.getByLabel('Response mode').click();
  await page.getByRole('option', { name: 'Fail', exact: true }).click();
  await input.fill('Unsaved product name');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not save');
  await expect(input).toHaveValue('Unsaved product name');
  await expect(
    page.getByText('Successful changes: 1', { exact: true }),
  ).toHaveCount(2);
  await page.screenshot({ path: `${output}/failed.png`, fullPage: false });
  await page.getByLabel('Response mode').click();
  await page
    .getByRole('option', { name: 'Slow (3 seconds)', exact: true })
    .click();
  await input.fill('Saved before cancellation');
  const write = page.waitForRequest((req) => req.method() === 'PATCH');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await write;
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await page.screenshot({ path: `${output}/pending.png`, fullPage: false });
  // Confirm the server mutation happened before cancelling the delayed response.
  await expect
    .poll(
      async () =>
        (await (await request.get(`${base}/api/clientServiceProducts`)).json())
          .data[0].name,
    )
    .toBe('Saved before cancellation');
  await page.getByRole('button', { name: 'Cancel request' }).click();
  await expect(page.getByText(/Request cancelled/)).toBeVisible();
  await expect(
    page.getByText('Successful changes: 1', { exact: true }),
  ).toHaveCount(2);
  await page.getByRole('button', { name: 'Refresh list' }).click();
  await expect(
    page.getByRole('button', { name: 'Edit Saved before cancellation' }),
  ).toBeVisible();
  await page.screenshot({ path: `${output}/cancelled.png`, fullPage: false });
  await page.getByRole('button', { name: 'Hide second view' }).click();
  await page.getByLabel('Response mode').click();
  await page.getByRole('option', { name: 'Normal', exact: true }).click();
  await input.fill('Final desk lamp');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page.getByText('Successful changes: 2', { exact: true }),
  ).toHaveCount(1);
  await page.screenshot({ path: `${output}/unmounted.png`, fullPage: false });
  await page.getByRole('button', { name: 'Show second view' }).click();
  await expect(
    page.getByText('Successful changes: 2', { exact: true }),
  ).toHaveCount(2);
  await page.reload();
  await expect(
    page.getByText('Successful changes: 0', { exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByRole('button', { name: 'Edit Final desk lamp' }),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 900 });
  await expect(
    page.getByRole('button', { name: 'Edit Final desk lamp' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      'document.documentElement.scrollWidth <= window.innerWidth',
    ),
  ).toBe(true);
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: false });
});

test('dark theme and narrow Chinese copy remain usable', async ({ page }) => {
  const mountPath = `${new URL(base ?? 'http://invalid.test').pathname.replace(/\/+$/u, '')}/`;
  const scope =
    encodeURIComponent(mountPath.replace(/^\/+|\/+$/gu, '')) || '%2F';
  await page.addInitScript(
    `localStorage.setItem(${JSON.stringify(`nocobase:${scope}:theme:color-scheme`)}, 'dark'); localStorage.setItem(${JSON.stringify(`nocobase.locale:${mountPath}`)}, 'zh-CN');`,
  );
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`${base}/service-products`);
  await expect(page.getByRole('heading', { name: '商品目录' })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page
    .getByRole('button', { name: /^编辑 / })
    .first()
    .click();
  await page.getByLabel('商品名称', { exact: true }).fill('');
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.getByRole('alert')).toContainText('请输入');
  await expect(page.getByLabel('商品名称', { exact: true })).toBeFocused();
  expect(
    await page.evaluate(
      'document.documentElement.scrollWidth <= window.innerWidth',
    ),
  ).toBe(true);
});
