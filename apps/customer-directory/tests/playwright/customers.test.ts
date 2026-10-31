/// <reference lib="dom" />
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from '@playwright/test';
import { customerResource } from '../../server/customer-resource.js';
const base = process.env.APP_URL?.replace(/\/$/, '') ?? '';
const username = process.env.E2E_USERNAME ?? '';
const password = process.env.E2E_PASSWORD ?? '';
test.skip(
  !base || !username || !password,
  'Set APP_URL, E2E_USERNAME and E2E_PASSWORD for a running demo with CUSTOMER_DEMO_FAULTS=1.',
);
test.use({
  actionTimeout: 10000,
  viewport: { width: 1440, height: 1000 },
  locale: 'en-US',
});
async function login(page: Page, user = username, pass = password) {
  await page.goto(`${base}/login`);
  await page.getByLabel('Username or email').fill(user);
  await page.getByLabel('Password', { exact: true }).fill(pass);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'));
}
async function shot(page: Page, name: string) {
  if (!process.env.SCREENSHOT_DIR) return;
  await mkdir(process.env.SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(process.env.SCREENSHOT_DIR, `${name}.png`),
    animations: 'disabled',
  });
}
async function choice(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function post(
  api: APIRequestContext,
  endpoint: string,
  data: unknown,
  method = 'POST',
) {
  return api.fetch(`${base}/api/${endpoint}`, {
    method,
    data,
    headers: {
      Origin: new URL(base).origin,
      'Idempotency-Key': `${Date.now()}.${randomUUID()}`,
    },
  });
}
async function count(page: Page, q: string) {
  const response = await page.request.get(`${base}/api/customerList`, {
    params: { q },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).meta.total as number;
}
test('query state, list states, nested edit and saved detail', async ({
  page,
}) => {
  await login(page);
  const original = (
    await (
      await page.request.get(`${base}/api/customerRecord/customer-02`)
    ).json()
  ).data;
  try {
    await page.goto(`${base}/customers`);
    await expect(
      page.getByRole('link', { name: 'Acorn Studio', exact: true }),
    ).toBeVisible();
    await shot(page, 'list');
    await page.goto(
      `${base}/customers?q=Al&status=active&pageSize=5&sort=name&order=desc`,
    );
    await expect(
      page.getByRole('link', { name: 'Alpine Goods', exact: true }),
    ).toBeVisible();
    await shot(page, 'query');
    const query = new URL(page.url()).search;
    await page.getByRole('link', { name: 'Alpine Goods', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await shot(page, 'detail');
    await page
      .getByRole('dialog')
      .getByText('Edit customer', { exact: true })
      .click();
    await expect(page.getByLabel('Customer name', { exact: true })).toHaveValue(
      'Alpine Goods',
    );
    await shot(page, 'edit');
    await page.getByLabel('Contact', { exact: true }).fill('Jordan Taylor');
    await page
      .getByRole('button', { name: 'Save customer', exact: true })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'Edit customer', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('dialog').getByText('Jordan Taylor', { exact: true }),
    ).toBeVisible();
    await shot(page, 'saved-detail');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(new URL(page.url()).search).toBe(query);
    await page.goto(`${base}/customers?q=NoSuchCustomer`);
    await expect(page.getByText('No results', { exact: true })).toBeVisible();
    await shot(page, 'empty');
    await page.goto(`${base}/customers`);
    await page
      .getByRole('button', { name: 'Request demonstrations', exact: true })
      .click();
    await choice(page, 'Read behavior', 'Slow response (1.6 seconds)');
    await shot(page, 'loading');
    await expect(
      page.getByRole('link', { name: 'Acorn Studio', exact: true }),
    ).toBeVisible();
    const refresh = page.getByRole('button', { name: 'Refresh', exact: true });
    await expect(refresh).toBeEnabled();
    await refresh.click();
    await expect(
      page.getByText('Refreshing the current query…', { exact: true }),
    ).toBeVisible();
    await shot(page, 'refreshing');
    await expect(refresh).toBeEnabled();
    await choice(page, 'Read behavior', 'Read failure');
    await expect(
      page.getByText('The request failed. Check your connection and retry.', {
        exact: true,
      }),
    ).toBeVisible();
    await shot(page, 'read-error');
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'Acorn Studio', exact: true }),
    ).toBeVisible();
  } finally {
    const { id, ...values } = original;
    await post(page.request, 'customers/updateOne', { filter: { id }, values });
  }
});
test('retains rejected drafts, recovers committed writes, and corrects the last page', async ({
  page,
}) => {
  await login(page);
  const suffix = randomUUID().slice(0, 8);
  const name = `Northwind ${suffix}`;
  const ids: string[] = [];
  try {
    await page.goto(`${base}/customers/new`);
    await page.getByLabel('Customer name', { exact: true }).fill(name);
    await page.getByLabel('Contact', { exact: true }).fill('Morgan Reed');
    await page.getByLabel('Email', { exact: true }).fill('morgan@example.test');
    await page
      .getByRole('button', { name: 'Submission demonstrations', exact: true })
      .click();
    await choice(page, 'Next submission', 'Reject before saving');
    await page
      .getByRole('button', { name: 'Save customer', exact: true })
      .click();
    await expect(
      page.getByText(/This demonstration rejected the write/),
    ).toBeVisible();
    await expect(page.getByLabel('Customer name', { exact: true })).toHaveValue(
      name,
    );
    expect(await count(page, name)).toBe(0);
    await shot(page, 'draft');
    await choice(page, 'Next submission', 'Lose response after saving');
    const write = page.waitForResponse((r) =>
      r.url().endsWith('/customers/createOne'),
    );
    await page
      .getByRole('button', { name: 'Save customer', exact: true })
      .click();
    const first = await write;
    expect(first.status()).toBe(503);
    const key = first.request().headers()['idempotency-key'];
    ids.push(key.slice(14));
    await expect(
      page.getByRole('button', {
        name: 'Retry original submission',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByLabel('Customer name', { exact: true }),
    ).toHaveAttribute('readonly', '');
    expect(await count(page, name)).toBe(1);
    await shot(page, 'uncertain');
    const replayed = page.waitForResponse((r) =>
      r.url().endsWith('/customers/createOne'),
    );
    await page
      .getByRole('button', { name: 'Retry original submission', exact: true })
      .click();
    const replay = await replayed;
    expect(replay.status()).toBe(200);
    expect(replay.headers()['idempotency-replayed']).toBe('true');
    expect(replay.request().headers()['idempotency-key']).toBe(key);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await count(page, name)).toBe(1);
    // Six test-owned records make a second page containing exactly one row.
    for (let n = 1; n <= 5; n++) {
      const id = randomUUID();
      ids.push(id);
      expect(
        (
          await post(page.request, 'customers/createOne', {
            values: {
              id,
              name: `${name} ${n}`,
              contact: 'Morgan Reed',
              email: 'morgan@example.test',
              status: 'active',
            },
          })
        ).ok(),
      ).toBeTruthy();
    }
    await page.goto(
      `${base}/customers?q=${encodeURIComponent(name)}&status=active&pageSize=5&page=2&sort=name&order=asc`,
    );
    await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
    await page
      .getByRole('button', { name: `Actions for ${name} 5`, exact: true })
      .click();
    await page
      .getByRole('menuitem', { name: 'Delete customer', exact: true })
      .click();
    await shot(page, 'delete');
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Delete customer', exact: true })
      .click();
    await expect(page.getByText('Page 1 of 1', { exact: true })).toBeVisible();
    const params = new URL(page.url()).searchParams;
    expect(params.get('page') ?? '1').toBe('1');
    expect(params.get('q')).toBe(name);
    expect(params.get('status')).toBe('active');
    expect(params.get('sort')).toBe('name');
    expect(params.get('order')).toBe('asc');
    await shot(page, 'corrected-page');
  } finally {
    for (const id of ids)
      await post(page.request, 'customers/deleteOne', { filter: { id } });
  }
});
test('a revoked business grant clears visible data and rejects reads and writes', async ({
  page,
  browser,
}) => {
  await login(page);
  const id = randomUUID().slice(0, 8);
  const key = `customer-check-${id}`;
  const pass = `Demo-${randomUUID()}`;
  const grants = [
    {
      resource: { type: 'page', id: 'customers' },
      actions: [{ action: 'access' }],
    },
    customerResource.reference().grant({ view: { customers: 'allRecords' } }),
  ];
  const created = await post(page.request, 'authorization/permissionSets', {
    key,
    title: 'Customer verification reader',
    grants,
  });
  expect(created.status()).toBe(201);
  const user = await post(page.request, 'users', {
    name: 'Customer reader',
    username: `reader.${id}`,
    email: `reader-${id}@example.test`,
    password: pass,
    roleScopes: { app: [key] },
  });
  expect(user.status()).toBe(201);
  const userId = (await user.json()).data.id;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'en-US',
  });
  const reader = await context.newPage();
  try {
    await login(reader, `reader.${id}`, pass);
    await reader.goto(`${base}/customers`);
    await expect(
      reader.getByRole('link', { name: 'Acorn Studio', exact: true }),
    ).toBeVisible();
    await expect(reader.getByText('Add customer', { exact: true })).toHaveCount(
      0,
    );
    expect(
      (
        await post(reader.request, 'customers/createOne', {
          values: {
            id: randomUUID(),
            name: 'Denied',
            contact: 'Reader',
            email: 'denied@example.test',
            status: 'active',
          },
        })
      ).status(),
    ).toBe(403);
    await reader.goto(`${base}/customers/new`);
    await expect(
      reader.getByText(
        'You no longer have access. Previous customer data has been cleared.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      reader.getByRole('button', { name: 'Save customer', exact: true }),
    ).toHaveCount(0);
    await reader.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(
      reader.getByRole('link', { name: 'Acorn Studio', exact: true }),
    ).toBeVisible();
    const readRole = await page.request.get(
      `${base}/api/authorization/permissionSets/${key}`,
    );
    const role = (await readRole.json()).data;
    expect(
      (
        await post(
          page.request,
          `authorization/permissionSets/${key}`,
          { expectedRevision: role.revision, grants: grants.slice(0, 1) },
          'PATCH',
        )
      ).ok(),
    ).toBeTruthy();
    await reader.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(
      reader.getByText(
        'You no longer have access. Previous customer data has been cleared.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      reader.getByRole('link', { name: 'Acorn Studio', exact: true }),
    ).toHaveCount(0);
    expect(
      (await reader.request.get(`${base}/api/customerList`)).status(),
    ).toBe(403);
    await shot(reader, 'permission');
  } finally {
    await context.close();
    await post(page.request, `users/${userId}`, undefined, 'DELETE');
    await post(
      page.request,
      `authorization/permissionSets/${key}`,
      undefined,
      'DELETE',
    );
  }
});
test('the edit dialog works at a narrow viewport and in dark appearance', async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${base}/customers/new`);
  await expect(page.getByRole('dialog')).toBeVisible();
  const bounds = await page.getByRole('dialog').boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(375);
  await page.getByLabel('Customer name', { exact: true }).fill('Mobile draft');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByRole('alertdialog', {
      name: 'Discard unsaved changes?',
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByLabel('Customer name', { exact: true })).toHaveValue(
    'Mobile draft',
  );
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass(/dark/);
  await shot(page, 'mobile');
});
test('blocks duplicate submissions while saving and restores an unresolved operation after reload', async ({
  page,
}) => {
  await login(page);
  const name = `Lumen ${randomUUID().slice(0, 8)}`;
  const ids: string[] = [];
  try {
    await page.goto(`${base}/customers/new`);
    await page.getByLabel('Customer name', { exact: true }).fill(name);
    await page.getByLabel('Contact', { exact: true }).fill('Morgan Reed');
    await page.getByLabel('Email', { exact: true }).fill('morgan@example.test');
    await page
      .getByRole('button', { name: 'Submission demonstrations', exact: true })
      .click();
    await choice(page, 'Next submission', 'Slow submission (1.6 seconds)');
    const requests: string[] = [];
    page.on('request', (r) => {
      if (r.url().endsWith('/customers/createOne'))
        requests.push(r.headers()['idempotency-key']);
    });
    await page
      .getByRole('button', { name: 'Save customer', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Saving…', exact: true }),
    ).toBeDisabled();
    await page.locator('#customer-form').evaluate((form: HTMLFormElement) => {
      form.requestSubmit();
      form.requestSubmit();
    });
    await shot(page, 'submitting');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(requests).toHaveLength(1);
    ids.push(requests[0].slice(14));
    expect(await count(page, name)).toBe(1);
    await page.goto(`${base}/customers/new`);
    await page
      .getByLabel('Customer name', { exact: true })
      .fill(`${name} recovery`);
    await page.getByLabel('Contact', { exact: true }).fill('Morgan Reed');
    await page.getByLabel('Email', { exact: true }).fill('morgan@example.test');
    await page
      .getByRole('button', { name: 'Submission demonstrations', exact: true })
      .click();
    await choice(page, 'Next submission', 'Lose response after saving');
    await page
      .getByRole('button', { name: 'Save customer', exact: true })
      .click();
    await expect(
      page.getByRole('button', {
        name: 'Retry original submission',
        exact: true,
      }),
    ).toBeVisible();
    ids.push(requests[1].slice(14));
    page.once('dialog', (dialog) => dialog.accept());
    await page.reload();
    await expect(
      page.getByText(/A previous submission is unresolved/),
    ).toBeVisible();
    await expect(page.getByLabel('Customer name', { exact: true })).toHaveValue(
      '',
    );
    await page
      .getByLabel('Customer name', { exact: true })
      .fill(`${name} recovery`);
    await page.getByLabel('Contact', { exact: true }).fill('Morgan Reed');
    await page.getByLabel('Email', { exact: true }).fill('morgan@example.test');
    const recovered = page.waitForResponse((r) =>
      r.url().endsWith('/customers/createOne'),
    );
    await page
      .getByRole('button', { name: 'Retry original submission', exact: true })
      .click();
    expect((await recovered).headers()['idempotency-replayed']).toBe('true');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(requests[2]).toBe(requests[1]);
    expect(await count(page, `${name} recovery`)).toBe(1);
  } finally {
    for (const id of ids)
      await post(page.request, 'customers/deleteOne', { filter: { id } });
  }
});
test('translates the customer list and editor through the native language menu', async ({
  page,
}) => {
  await login(page);
  await page.goto(`${base}/customers`);
  await page
    .getByRole('button', { name: 'Open account menu', exact: true })
    .click();
  await page.getByRole('menuitem', { name: /Language/ }).click();
  await page.getByRole('menuitemradio', { name: /中文/ }).click();
  await expect(
    page.getByRole('heading', { name: '客户通讯录', exact: true }),
  ).toBeVisible();
  await page.goto(`${base}/customers/new`);
  await expect(page.getByLabel('客户名称', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '保存客户', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '打开账户菜单', exact: true }).click();
  await page.getByRole('menuitem', { name: /语言/ }).click();
  await page.getByRole('menuitemradio', { name: /English/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Customer directory', exact: true }),
  ).toBeVisible();
});
