import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const base = process.env.APP_URL?.replace(/\/$/, '');
if (!base)
  throw new Error('Set APP_URL to the complete test application entry URL.');
const accounts = JSON.parse(
  await readFile(new URL('../../storage/demo.json', import.meta.url), 'utf8'),
) as { role: string; email: string; password: string }[];
test.use({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
async function account(role: string) {
  return accounts.find((item) => item.role === role)!;
}
test('editor creates, reloads and publishes a product', async ({ page }) => {
  const editor = await account('catalog-editor');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/login`);
  await page.getByLabel('Username or email').fill(editor.email);
  await page.getByLabel('Password', { exact: true }).fill(editor.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'));
  await page.goto(`${base}/products`);
  await expect(
    page.getByRole('heading', { name: 'Products', exact: true }),
  ).toBeVisible();
  const name = `Desk organizer ${Date.now()}`;
  await page.getByLabel('Product name', { exact: true }).fill(name);
  await page.getByLabel('Price in cents', { exact: true }).fill('2400');
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(page.getByText('Draft created.', { exact: true })).toBeVisible();
  await page.reload();
  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toContainText('Draft');
  if (process.env.SCREENSHOT_DIR) {
    await mkdir(process.env.SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(process.env.SCREENSHOT_DIR, 'testing-products-draft.png'),
      fullPage: false,
    });
  }
  await row.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(row).toContainText('Published');
  await page.reload();
  await expect(row).toContainText('Published');
  const list = await page.request.get(
    `${base}/api/products?q=${encodeURIComponent(name)}`,
  );
  expect(list.status()).toBe(200);
  expect((await list.json()).data).toEqual([
    expect.objectContaining({ name, priceCents: 2400, published: true }),
  ]);
  if (process.env.SCREENSHOT_DIR)
    await page.screenshot({
      path: path.join(
        process.env.SCREENSHOT_DIR,
        'testing-products-published.png',
      ),
      fullPage: false,
    });
  expect(errors).toEqual([]);
});
test('viewer sees products but cannot create them through the page or API', async ({
  page,
}) => {
  const viewer = await account('catalog-viewer');
  const response = await page.request.post(`${base}/api/auth/sign-in/email`, {
    headers: { Origin: new URL(base!).origin },
    data: { email: viewer.email, password: viewer.password },
  });
  expect(response.status()).toBe(200);
  await page.goto(`${base}/products`);
  await expect(
    page.getByText(
      'Your account can view products but cannot create or publish them.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Create draft', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Publish', exact: true }),
  ).toHaveCount(0);
  const denied = await page.request.post(`${base}/api/products`, {
    headers: {
      Origin: new URL(base!).origin,
      'Idempotency-Key': `${Date.now()}.${crypto.randomUUID()}`,
    },
    data: { name: 'Unauthorized product', priceCents: 100 },
  });
  expect(denied.status()).toBe(403);
  const download = await page.request.get(`${base}/catalog/export.csv`);
  expect(download.status()).toBe(200);
  expect(await download.text()).toContain('name');
  if (process.env.SCREENSHOT_DIR)
    await page.screenshot({
      path: path.join(
        process.env.SCREENSHOT_DIR,
        'testing-products-viewer.png',
      ),
      fullPage: false,
    });
});

test('failed submission keeps input and a pending retry cannot submit twice', async ({
  page,
}) => {
  const editor = await account('catalog-editor');
  const login = await page.request.post(`${base}/api/auth/sign-in/email`, {
    headers: { Origin: new URL(base!).origin },
    data: { email: editor.email, password: editor.password },
  });
  expect(login.status()).toBe(200);
  await page.goto(`${base}/products`);
  await page
    .getByLabel('Product name', { exact: true })
    .fill(`Recovery tray ${Date.now()}`);
  await page.getByLabel('Price in cents', { exact: true }).fill('1800');
  let requests = 0;
  let resume!: () => void;
  const pending = new Promise<void>((resolve) => {
    resume = resolve;
  });
  await page.route('**/api/products', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    requests += 1;
    if (requests === 1)
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'Simulated unavailable service' },
        }),
      });
    await pending;
    await route.continue();
  });
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Your input has been kept',
  );
  if (process.env.SCREENSHOT_DIR)
    await page.screenshot({
      path: path.join(
        process.env.SCREENSHOT_DIR,
        'testing-products-failure.png',
      ),
      fullPage: false,
    });
  try {
    await page
      .getByRole('button', { name: 'Create draft', exact: true })
      .click();
    await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(requests).toBe(2);
    if (process.env.SCREENSHOT_DIR)
      await page.screenshot({
        path: path.join(
          process.env.SCREENSHOT_DIR,
          'testing-products-pending.png',
        ),
        fullPage: false,
      });
  } finally {
    resume();
  }
  await expect(page.getByText('Draft created.', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(requests).toBe(2);
});
