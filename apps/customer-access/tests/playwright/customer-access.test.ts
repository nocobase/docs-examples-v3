import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const entry = process.env.APP_URL;
const accountsFile = process.env.E2E_ACCOUNTS_FILE;
const output = process.env.SCREENSHOT_DIR;
test.skip(
  !entry || !accountsFile,
  'Provide a dedicated instance and test account file.',
);
test.use({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
async function credentials(role: string) {
  return JSON.parse(await readFile(accountsFile!, 'utf8'))[role] as {
    email: string;
    password: string;
  };
}
async function shot(page: import('@playwright/test').Page, name: string) {
  if (!output) return;
  await mkdir(output, { recursive: true });
  await page.screenshot({
    path: path.join(output, `${name}.png`),
    fullPage: false,
    animations: 'disabled',
  });
}
async function login(page: import('@playwright/test').Page, role: string) {
  const response = await page.request.post(`${entry}/api/auth/sign-in/email`, {
    data: await credentials(role),
    headers: { Origin: new URL(entry!).origin },
  });
  expect(response.status()).toBe(200);
}
test('sales can edit, create and assign through native pages; scope holds after reload', async ({
  page,
}) => {
  await login(page, 'alice');
  await page.goto(`${entry}/customers`);
  await expect(
    page.getByRole('heading', { name: 'Customers', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Acme Supplies', { exact: true })).toBeVisible();
  await shot(page, 'customers');
  await page.getByRole('button', { name: 'Actions for Acme Supplies' }).click();
  await page.getByRole('menuitem', { name: 'Edit customer' }).click();
  await expect(page.locator('[data-slot=route-overlay-content]')).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Name', exact: true }),
  ).toHaveValue('Acme Supplies');
  await page.getByLabel('Notes').fill('Follow up after the product review');
  await shot(page, 'customer-edit');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.locator('[data-slot=route-overlay-content]'),
  ).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByText('Follow up after the product review', { exact: true }),
  ).toBeVisible();
  // Check real search/count and typed input, not only fill.
  const search = page.getByRole('textbox', {
    name: 'Search by customer name',
  });
  await search.pressSequentially('NoSuchCustomer');
  await expect(
    page.getByText('Acme Supplies', { exact: true }),
  ).not.toBeVisible();
  await search.fill('');
  await expect(page.getByText('Acme Supplies', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New customer' }).click();
  const newName = `Pine Grove Books ${Date.now()}`;
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(newName);
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill('pine@example.test');
  await shot(page, 'customer-create');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.locator('[data-slot=route-overlay-content]'),
  ).not.toBeVisible();
  await expect(page.getByText(newName, { exact: true })).toBeVisible();
  await page.goto(`${entry}/orders`);
  await page.getByRole('button', { name: 'Actions for SO-1001' }).click();
  await page.getByRole('menuitem', { name: 'Change customer' }).click();
  await page.getByRole('combobox', { name: 'Select customer' }).click();
  await page.getByRole('option', { name: 'Harbor Retail' }).click();
  await expect(
    page.getByRole('option', { name: 'Harbor Retail' }),
  ).not.toBeVisible();
  await shot(page, 'order-customer');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.locator('[data-slot=route-overlay-content]'),
  ).not.toBeVisible();
  const orders = await (await page.request.get(`${entry}/api/orders`)).json();
  const customers = await (
    await page.request.get(`${entry}/api/customers`)
  ).json();
  expect(orders.data[0].customerId).toBe(
    customers.data.find((r: { name: string }) => r.name === 'Harbor Retail').id,
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${entry}/customers`);
  await expect(
    page.getByRole('heading', { name: 'Customers', exact: true }),
  ).toBeVisible();
  await shot(page, 'customers-mobile');
});
test('reader has no write controls and direct calls are denied', async ({
  page,
}) => {
  await login(page, 'bob');
  await page.goto(`${entry}/customers`);
  await expect(page.getByText('Acme Supplies', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New customer' })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: /Actions for/ })).toHaveCount(
    0,
  );
  expect(
    (
      await page.request.post(`${entry}/api/customers`, {
        data: {},
        headers: { Origin: new URL(entry!).origin },
      })
    ).status(),
  ).toBe(403);
  await shot(page, 'customers-readonly');
});
test('administrator can inspect editable business role and separate scopes', async ({
  page,
}) => {
  await login(page, 'admin');
  await page.goto(`${entry}/settings/roles/customer-sales/edit`);
  await page.getByRole('tab', { name: 'Business operations' }).click();
  await expect(
    page.getByText('Change customer', { exact: true }),
  ).toBeVisible();
  await page
    .getByText('Change customer', { exact: true })
    .scrollIntoViewIfNeeded();
  await page
    .getByText('Change customer', { exact: true })
    .evaluate((element) => {
      for (
        let parent: HTMLElement | null = element;
        parent;
        parent = parent.parentElement
      )
        if (parent.scrollHeight > parent.clientHeight + 1)
          parent.scrollTop = parent.scrollHeight;
    });
  await expect
    .poll(async () =>
      page
        .getByText('Records I own', { exact: true })
        .last()
        .evaluate((element) => element.getBoundingClientRect().bottom),
    )
    .toBeLessThan(740);
  await shot(page, 'permissions');
});

test('loading, empty, denied and transient failures never display inaccessible records', async ({
  page,
}) => {
  await login(page, 'alice');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/customers?*', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(`${entry}/customers`);
  await expect(
    page.getByRole('status').filter({ hasText: 'Loading' }).first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'New customer' })).toHaveCount(
    0,
  );
  release();
  await expect(page.getByText('Acme Supplies', { exact: true })).toBeVisible();
  await page.unroute('**/api/customers?*');
  await page.route('**/api/customers?*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Test unavailable' } }),
    }),
  );
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Retry', exact: true }),
  ).toBeVisible();
  await page.unroute('**/api/customers?*');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('Acme Supplies', { exact: true })).toBeVisible();
  await page.route('**/api/customers?*', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Test denied' } }),
    }),
  );
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(
    page.getByText('Acme Supplies', { exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Retry', exact: true }),
  ).toHaveCount(0);
  await page.unroute('**/api/customers?*');
  await page.goto(`${entry}/customers?q=missing-customer`);
  await expect(
    page.getByText('Acme Supplies', { exact: true }),
  ).not.toBeVisible();
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto(`${entry}/customers`);
  await expect(page.getByText('Acme Supplies', { exact: true })).toBeVisible();
  await shot(page, 'customers-dark');
});

test('edit keeps one dialog, validates fields and stops writes when the record disappears', async ({
  page,
}) => {
  await login(page, 'alice');
  await page.goto(`${entry}/customers?q=Acme&page=1&pageSize=10`);
  await page.getByRole('button', { name: 'Actions for Acme Supplies' }).click();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/customers/*/editData', async (route) => {
    await gate;
    await route.continue();
  });
  await page.getByRole('menuitem', { name: 'Edit customer' }).click();
  const dialog = page.locator('[data-slot=route-overlay-content]');
  await expect(dialog).toBeVisible();
  await dialog.evaluate((element) => {
    element.setAttribute('data-continuity', 'original');
  });
  release();
  await expect(
    page.getByRole('textbox', { name: 'Name', exact: true }),
  ).toHaveValue('Acme Supplies');
  await expect(dialog).toHaveAttribute('data-continuity', 'original');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/customers\?q=Acme&page=1&pageSize=10$/);
  await page.getByRole('button', { name: 'Actions for Acme Supplies' }).click();
  await page.getByRole('menuitem', { name: 'Edit customer' }).click();
  await expect(
    page.getByRole('textbox', { name: 'Name', exact: true }),
  ).toHaveValue('Acme Supplies');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page).toHaveURL(/customers\?q=Acme&page=1&pageSize=10$/);
  await page.getByRole('button', { name: 'Actions for Acme Supplies' }).click();
  await page.getByRole('menuitem', { name: 'Edit customer' }).click();
  const name = page.getByRole('textbox', { name: 'Name', exact: true });
  await expect(name).toHaveValue('Acme Supplies');
  await name.fill('');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toBeFocused();
  // Whitespace passes native required but fails the real server's trimmed schema.
  await name.fill(' ');
  const invalid = page.waitForResponse(
    (response) => response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await invalid).status()).toBe(400);
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toBeFocused();
  await name.fill('Acme Supplies');
  await expect(name).not.toHaveAttribute('aria-invalid', 'true');
  await page.route('**/api/customers/*', async (route) => {
    if (route.request().method() === 'PATCH')
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Unavailable' } }),
      });
    else await route.continue();
  });
  const refresh = page.waitForResponse((response) =>
    response.url().includes('/api/customers?'),
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await refresh;
  await expect(page.getByText('This record is unavailable.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to list' }).click();
  await expect(page).toHaveURL(/customers\?q=Acme&page=1&pageSize=10$/);
});

test('list corrects pagination, clears search, keeps rows during refresh and classifies errors', async ({
  page,
}) => {
  await login(page, 'alice');
  await page.goto(`${entry}/customers?page=99&q=Acme`);
  await expect(page.getByText('Acme Supplies', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/page=1&q=Acme$/);
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: 'Search by customer name' }),
  ).toHaveValue('');
  await expect(page.getByText('Harbor Retail', { exact: true })).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/customers?*', async (route) => {
    await gate;
    await route.continue();
  });
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('table')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByText('Acme Supplies', { exact: true })).toBeVisible();
  release();
  await expect(page.getByRole('table')).toHaveAttribute('aria-busy', 'false');
  await page.unroute('**/api/customers?*');
  // Exercise an actual IME composition without changing any record.
  const search = page.getByRole('textbox', { name: 'Search by customer name' });
  await search.focus();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', {
    text: 'ke',
    selectionStart: 2,
    selectionEnd: 2,
  });
  await cdp.send('Input.insertText', { text: '客' });
  await expect(search).toHaveValue('客');
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  for (const status of [400, 403, 401]) {
    await page.route('**/api/customers?*', (route) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Controlled error' } }),
      }),
    );
    await page.reload();
    await expect(page.getByRole('table')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByText('Acme Supplies', { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole('button', { name: 'New customer' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Retry', exact: true }),
    ).toHaveCount(0);
    if (status === 401)
      await expect(
        page.getByRole('button', { name: 'Sign in', exact: true }),
      ).toBeVisible();
    await page.unroute('**/api/customers?*');
  }
});

test('assignment keeps its dialog and returns to the same list after a missing order', async ({
  page,
}) => {
  await login(page, 'alice');
  await page.goto(`${entry}/orders?q=SO&page=1`);
  await page.getByRole('button', { name: 'Actions for SO-1001' }).click();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/orders/*/assignment', async (route) => {
    await gate;
    await route.continue();
  });
  await page.getByRole('menuitem', { name: 'Change customer' }).click();
  const dialog = page.locator('[data-slot=route-overlay-content]');
  await expect(dialog).toBeVisible();
  await dialog.evaluate((element) => {
    element.setAttribute('data-continuity', 'original');
  });
  release();
  await expect(
    page.getByRole('combobox', { name: 'Select customer' }),
  ).toBeEnabled();
  await expect(dialog).toHaveAttribute('data-continuity', 'original');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/orders\?q=SO&page=1$/);
  await page.getByRole('button', { name: 'Actions for SO-1001' }).click();
  await page.getByRole('menuitem', { name: 'Change customer' }).click();
  await page.getByRole('combobox', { name: 'Select customer' }).click();
  await page.getByRole('option', { name: 'Harbor Retail' }).click();
  await page.route('**/api/orders/*/assignCustomer', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Unavailable' } }),
    }),
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('This record is unavailable.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to list' }).click();
  await expect(page).toHaveURL(/orders\?q=SO&page=1$/);
});
