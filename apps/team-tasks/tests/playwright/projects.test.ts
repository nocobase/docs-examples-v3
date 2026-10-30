import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
const origin = process.env.TUTORIAL_ORIGIN;
if (!origin)
  throw new Error('Set TUTORIAL_ORIGIN to a disposable tutorial app.');
const base = `${origin}/main`;
const headers = () => ({
  origin,
  'Idempotency-Key': `${Date.now()}.${randomUUID()}`,
});
test.setTimeout(60_000);
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
async function login(page: Page, role = 'creator') {
  await page.goto(`${base}/login`);
  await page
    .getByRole('textbox', { name: 'Username or email' })
    .fill(
      role === 'admin'
        ? (process.env.TUTORIAL_USERNAME ?? 'nocobase')
        : `projecte2e${role}`,
    );
  await page
    .getByRole('textbox', { name: 'Password', exact: true })
    .fill(
      role === 'admin'
        ? (process.env.TUTORIAL_PASSWORD ?? 'admin123')
        : 'Tutorial123!',
    );
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/main\/?$/u);
}
const shot = (page: Page, name: string) =>
  page.screenshot({
    path: `storage/ui-workflow/project-routing/screenshots/${name}.png`,
    fullPage: true,
    animations: 'disabled',
  });

test('paging, guarded submission, Chinese input and clean documentation screenshots', async ({
  page,
  context,
}) => {
  await login(page);
  let releaseLoad!: () => void;
  const holdLoad = new Promise<void>((resolve) => {
    releaseLoad = resolve;
  });
  await page.route('**/api/projects?*', async (route) => {
    await holdLoad;
    await route.continue();
  });
  await page.goto(`${base}/projects`);
  await expect(page.getByLabel('Loading projects')).toBeVisible();
  await shot(page, 'loading');
  releaseLoad();
  await expect(
    page.getByRole('button', { name: 'New project', exact: true }),
  ).toBeVisible();
  await page.unroute('**/api/projects?*');
  await shot(page, 'projects-list');
  await page.goto(`${base}/projects/new?q=Website`);
  const input = page.getByRole('textbox', { name: /Project name/u });
  await input.fill('Customer portal');
  await shot(page, 'new-project');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const filter = `paging-${Date.now()}`;
  for (let i = 1; i <= 11; i++) {
    const response = await context.request.post(`${base}/api/projects`, {
      headers: headers(),
      data: { name: `${filter} ${i}` },
    });
    expect(response.status()).toBe(201);
  }
  await page.goto(`${base}/projects?q=${filter}`);
  await page
    .getByRole('button', { name: 'Go to next page', exact: true })
    .click();
  await expect(page).toHaveURL(`${base}/projects?q=${filter}&page=2`);
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(`${base}/projects?q=${filter}&page=2`);
  await page.reload();
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await input.click();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.imeSetComposition', {
    text: 'xiangmu',
    selectionStart: 7,
    selectionEnd: 7,
  });
  await cdp.send('Input.insertText', { text: '中文项目' });
  await expect(input).toHaveValue('中文项目');
  let releaseSave!: () => void;
  const holdSave = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  let writes = 0;
  await page.route('**/api/projects', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    writes++;
    await holdSave;
    await route.continue();
  });
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('button', { name: /Creating…/u })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeDisabled();
  await input.press('Escape');
  await page.goBack();
  await expect(page).toHaveURL(`${base}/projects/new?q=${filter}&page=2`);
  releaseSave();
  await expect(page).toHaveURL(`${base}/projects?q=${filter}&page=2`);
  expect(writes).toBe(1);
  await expect(
    page.getByRole('cell', { name: '中文项目', exact: true }),
  ).toHaveCount(0);
  await page.unroute('**/api/projects');
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page.getByRole('menuitem', { name: /Language/u }).hover();
  await page.getByRole('menuitemradio', { name: /中文/u }).click();
  await expect(
    page.getByRole('heading', { name: '项目', exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-slot="toast-title"]')).toHaveCount(0, {
    timeout: 10_000,
  });
  await shot(page, 'chinese-list');
  await page.getByRole('button', { name: '新建项目', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /项目名称/u })).toBeVisible();
  await shot(page, 'chinese-form');
});
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, 'admin');
  for (const role of ['creator', 'reader', 'none']) {
    const username = `projecte2e${role}`;
    const found = await (
      await context.request.get(
        `${base}/api/users?q=${username}%40example.test`,
      )
    ).json();
    if (found.data.length) continue;
    const response = await context.request.post(`${base}/api/users`, {
      headers: headers(),
      data: {
        name: `Project ${role}`,
        username,
        email: `${username}@example.test`,
        password: 'Tutorial123!',
        roleScopes: { app: role === 'none' ? [] : [`project-${role}`] },
      },
    });
    expect(response.status()).toBe(201);
  }
  await context.close();
});
test('create, search, child URLs, reload, history, focus and persistence', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page);
  const baseline = [...errors];
  await page.getByRole('link', { name: 'Projects', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Projects', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'New project', exact: true }),
  ).toBeVisible();
  await shot(page, 'initial');
  for (const name of [
    'Website launch',
    'Customer onboarding',
    'Mobile app redesign',
  ]) {
    await page
      .getByRole('button', { name: 'New project', exact: true })
      .click();
    const input = page.getByRole('textbox', { name: /Project name/u });
    await input.pressSequentially(name);
    await expect(input).toHaveValue(name);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.locator('[data-slot=route-overlay-content]')).toHaveCount(
      0,
    );
    await expect(
      page.getByRole('cell', { name, exact: true }).first(),
    ).toBeVisible();
  }
  await shot(page, 'projects-list');
  const search = page.getByRole('textbox', {
    name: 'Search projects',
    exact: true,
  });
  await search.pressSequentially('Website');
  await search.press('Enter');
  await expect(page).toHaveURL(`${base}/projects?q=Website`);
  await expect(
    page.getByRole('cell', { name: 'Customer onboarding', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page).toHaveURL(`${base}/projects/new?q=Website`);
  const input = page.getByRole('textbox', { name: /Project name/u });
  await input.pressSequentially('Customer portal');
  await shot(page, 'new-project');
  await page.goBack();
  await expect(page).toHaveURL(`${base}/projects?q=Website`);
  await page.goForward();
  await expect(input).toBeVisible();
  await page.reload();
  await expect(input).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(`${base}/projects?q=Website`);
  await expect(search).toHaveValue('Website');
  await page.goto(`${base}/projects/new?q=Website`);
  await expect(input).toBeVisible();
  await input.press('Escape');
  await expect(page).toHaveURL(`${base}/projects?q=Website`);
  await expect(search).toBeFocused();
  await search.fill('missing-project');
  await search.press('Enter');
  await expect(
    page.getByText(
      'No matching projects. Try another name or clear the search.',
    ),
  ).toBeVisible();
  await shot(page, 'no-results');
  await search.fill('');
  await search.pressSequentially('Websitelauch');
  await search.press('ArrowLeft');
  await search.press('ArrowLeft');
  await search.pressSequentially('n');
  await expect(search).toHaveValue('Websitelaunch');
  await search.fill('');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.imeSetComposition', {
    text: 'xiang',
    selectionStart: 5,
    selectionEnd: 5,
  });
  await cdp.send('Input.insertText', { text: '项目' });
  await expect(search).toHaveValue('项目');
  expect(errors).toEqual(baseline);
});
test('ordinary reader and unassigned user cannot bypass create or page access', async ({
  browser,
}) => {
  for (const role of ['reader', 'none']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, role);
    await page.goto(`${base}/projects`);
    expect((await context.request.get(`${base}/api/projects`)).status()).toBe(
      role === 'reader' ? 200 : 403,
    );
    expect(
      (
        await context.request.post(`${base}/api/projects`, {
          headers: headers(),
          data: { name: 'Forbidden' },
        })
      ).status(),
    ).toBe(403);
    await expect(
      page.getByRole('button', { name: 'New project', exact: true }),
    ).toHaveCount(0);
    await page.goto(`${base}/projects/new`);
    await expect(
      page.getByRole('heading', { name: 'Access denied', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: /Project name/u }),
    ).toHaveCount(0);
    await shot(page, `${role}-denied`);
    await context.close();
  }
});
test('load failures, responsive form and theme presets', async ({ page }) => {
  await login(page);
  for (const status of [500, 403]) {
    await page.route('**/api/projects?*', (route) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: status, message: 'Deliberate failure' },
        }),
      }),
    );
    await page.goto(`${base}/projects`);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Retry', exact: true }),
    ).toHaveCount(status === 500 ? 1 : 0);
    await shot(page, `load-${status}`);
    await page.unroute('**/api/projects?*');
  }
  await page.route('**/api/projects?*', (route) => route.abort());
  await page.goto(`${base}/projects`);
  await expect(
    page.getByRole('button', { name: 'Retry', exact: true }),
  ).toBeVisible();
  await page.unroute('**/api/projects?*');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'New project', exact: true }),
  ).toBeVisible();
  for (const preset of ['default', 'compact'])
    for (const scheme of ['light', 'dark']) {
      await page.evaluate(
        ({ preset, scheme }) => {
          localStorage.setItem('nocobase:main:theme:preset', preset);
          localStorage.setItem('nocobase:main:theme:color-scheme', scheme);
        },
        { preset, scheme },
      );
      await page.reload();
      await expect(
        page.getByRole('button', { name: 'New project', exact: true }),
      ).toBeVisible();
      await shot(page, `${preset}-${scheme}`);
    }
  await page.setViewportSize({ width: 375, height: 812 });
  const longName = 'W'.repeat(120);
  await page.route('**/api/projects?*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data = [{ ...body.data[0], name: longName }];
    body.meta = { total: 1, page: 1, pageSize: 10 };
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  const nameCell = page.getByRole('cell', { name: longName, exact: true });
  await expect(nameCell).toBeVisible();
  await expect(nameCell.locator('span').first()).toHaveCSS(
    'text-overflow',
    'ellipsis',
  );
  expect(
    await page
      .locator('[data-slot=table-container]')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await nameCell.locator('span').first().hover();
  await expect(page.locator('[data-slot=tooltip-content]')).toHaveText(
    longName,
  );
  await page.mouse.move(0, 0);
  await shot(page, 'mobile-list');
  expect(
    await page.evaluate(
      'document.documentElement.scrollWidth <= window.innerWidth',
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Create', exact: true }),
  ).toBeVisible();
  await shot(page, 'mobile-form');
  await page
    .getByRole('textbox', { name: /Project name/u })
    .fill('Expired session example');
  await page.route('**/api/projects', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 401,
          status: 'UNAUTHENTICATED',
          message: 'Deliberate expired session',
        },
      }),
    }),
  );
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Your session has expired. Sign in again.',
  );
  await expect(
    page.getByRole('link', { name: 'Sign in', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Create', exact: true }),
  ).toBeDisabled();
});
