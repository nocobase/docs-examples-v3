import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

// Documentation capture is an explicit, separate run; routine tests do not write screenshots.
const entry = process.env.APP_URL;
if (!entry)
  throw new Error('Set APP_URL to the running application, including /main/.');
const base = new URL(`${entry.replace(/\/+$/, '')}/`);
const output = resolve(
  process.env.SCREENSHOT_DIR ?? 'storage/documentation/screenshots',
);
const mode = process.env.CAPTURE_MODE ?? 'admin';
if (mode === 'limited') {
  const viewer = JSON.parse(
    await readFile('storage/documentation/viewer.json', 'utf8'),
  );
  process.env.E2E_USERNAME = viewer.username;
  process.env.E2E_PASSWORD = viewer.password;
}
const browser = await chromium.launch();
const context = await browser.newContext({
  locale: 'en-US',
  viewport: { width: 1280, height: 800 },
  colorScheme: 'light',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const url = (path) => new URL(path.replace(/^\//, ''), base).href;
await mkdir(output, { recursive: true });
async function open(path) {
  await page.goto(url(path));
}
async function shot(name) {
  await page.screenshot({
    path: resolve(output, `${name}.png`),
    animations: 'disabled',
  });
}
async function heading(text) {
  await expect(
    page.getByRole('heading', { name: text, exact: true }).first(),
  ).toBeVisible();
}
async function login() {
  if (!process.env.E2E_USERNAME || !process.env.E2E_PASSWORD)
    throw new Error(
      'Set E2E_USERNAME and E2E_PASSWORD for a dedicated demonstration account.',
    );
  await open('login');
  await page.getByLabel('Username or email').fill(process.env.E2E_USERNAME);
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.endsWith('/login'));
  await heading('Pages, routes and navigation');
  const response = await page.request.get(url('api/auth/get-session'));
  expect(response.status()).toBe(200);
  expect((await response.json()).user.id).toEqual(expect.any(String));
}
try {
  if (mode === 'public') {
    await open('projects');
    await page.waitForURL(/\/login$/);
    await expect(page.getByLabel('Username or email')).toBeVisible();
    await shot('login');
    await open('welcome');
    await heading('Guest welcome');
    await shot('guest');
    await open('public-projects');
    await heading('Public project information');
    await shot('public');
  } else {
    await login();
    if (mode === 'limited') {
      await open('projects');
      await heading('Project list');
      await expect(
        page.getByRole('button', { name: 'New draft', exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('link', { name: 'Administrator notes', exact: true }),
      ).toHaveCount(0);
      await shot('viewer');
      await open('projects/new');
      await heading('Access denied');
      await shot('draft-denied');
      await open('admin-notes/child');
      await heading('Access denied');
      await shot('admin-denied');
      await open('reports/owners');
      await expect(page.getByText('Avery Morgan: Harbor launch')).toBeVisible();
    } else if (mode === 'disabled') {
      await open('reports/summary');
      await heading('Project reports');
      await expect(
        page.getByRole('link', { name: 'Reporting snapshot', exact: true }),
      ).toHaveCount(0);
      await shot('plugin-disabled');
    } else if (mode === 'original') {
      await open('reports/snapshot');
      await heading('Reporting snapshot');
      await expect(
        page.getByText('The original reporting contribution.'),
      ).toBeVisible();
      await shot('plugin-original');
    } else {
      await shot('home');
      await open('projects');
      await heading('Project list');
      await expect(
        page.getByRole('button', { name: 'New draft', exact: true }),
      ).toBeVisible();
      await shot('projects');
      await page.getByLabel('Search projects').fill('Harbor');
      await expect(page).toHaveURL(/projects\?q=Harbor$/);
      await shot('filtered');
      await page
        .getByRole('link', { name: 'Harbor launch', exact: true })
        .click();
      await heading('Harbor launch');
      await shot('drawer');
      await page
        .getByRole('link', { name: 'Prepare launch checklist', exact: true })
        .click();
      await heading('Prepare launch checklist');
      await shot('task');
      await page.getByRole('button', { name: 'Back to project' }).click();
      await expect(page).toHaveURL(/projects\/p100\?q=Harbor$/);
      await page.getByRole('button', { name: 'Back to list' }).click();
      await expect(page).toHaveURL(/projects\?q=Harbor$/);
      await expect(page.getByLabel('Search projects')).toHaveValue('Harbor');
      await open('projects/missing');
      await expect(page.getByRole('alert')).toContainText('does not exist');
      await shot('missing');
      await open('projects/workspace/p100?q=Harbor');
      await heading('Harbor launch');
      await shot('workspace');
      await page
        .getByRole('link', { name: 'Project list', exact: true })
        .last()
        .click();
      await expect(page).toHaveURL(/projects\?q=Harbor$/);
      await open('project-pages/p100?q=Harbor');
      await heading('Harbor launch');
      await shot('standalone');
      await open('projects/new?q=Harbor');
      await page
        .getByLabel('Project name', { exact: true })
        .fill('Partner onboarding');
      await shot('draft');
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await shot('guard');
      await page.getByRole('button', { name: 'Keep editing' }).click();
      await expect(
        page.getByLabel('Project name', { exact: true }),
      ).toHaveValue('Partner onboarding');
      await page.getByRole('button', { name: 'Preview draft' }).click();
      await expect(page.getByRole('status')).toContainText(
        'Draft preview: Partner onboarding',
      );
      await shot('draft-preview');
      await page.getByRole('button', { name: 'Finish preview' }).click();
      await expect(page).toHaveURL(/projects\?q=Harbor$/);
      await page
        .getByRole('button', { name: 'New draft', exact: true })
        .click();
      await page
        .getByLabel('Project name', { exact: true })
        .fill('History draft');
      await page.goBack();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('button', { name: 'Keep editing' }).click();
      await expect(page).toHaveURL(/projects\/new\?q=Harbor$/);
      await page.goBack();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('button', { name: 'Discard draft' }).click();
      await expect(page).toHaveURL(/projects\?q=Harbor$/);
      await open('reports?period=quarter');
      await expect(page).toHaveURL(/reports\/summary\?period=quarter$/);
      await expect(page.getByText('2 sample projects')).toBeVisible();
      await shot('summary');
      await page.getByRole('button', { name: 'Owners', exact: true }).click();
      await expect(page.getByText('Avery Morgan: Harbor launch')).toBeVisible();
      await shot('owners');
      await shot('navigation');
      await open('admin-notes/child');
      await expect(
        page.getByText(
          'This child uses authz: skip. The unrestricted parent still guards the entire route.',
        ),
      ).toBeVisible();
      await shot('admin');
      await open('reports/exports');
      await heading('Export instructions');
      await shot('exports');
      await open('reports/snapshot');
      await heading('Reporting snapshot');
      await expect(
        page.getByText(
          'This application replaced the reporting plugin component.',
          { exact: false },
        ),
      ).toBeVisible();
      await shot('plugin-custom');
      await page.getByRole('link', { name: 'Home', exact: true }).click();
      await heading('Pages, routes and navigation');
      await page
        .getByRole('button', { name: 'Try a slow page', exact: true })
        .click();
      await expect(page.getByRole('status')).toBeVisible();
      await shot('loading');
      await heading('Try a slow page');
      await shot('loaded');
      await open('route-status/error');
      await heading('Unable to load page');
      await shot('error');
      await open('unknown-example');
      await heading('Pages, routes and navigation');
      await expect(page).toHaveURL(
        new RegExp(`${base.pathname.replace(/\/$/, '')}/?$`),
      );
      await shot('unknown');
      await open('welcome?redirect=%2Freports%2Fowners');
      await expect(page).toHaveURL(/reports\/owners$/);
      // Runtime acceptance beyond the desktop documentation shots.
      await page.setViewportSize({ width: 375, height: 812 });
      await open('projects/p100/tasks/t200');
      await heading('Prepare launch checklist');
      expect(
        await page.evaluate(
          () =>
            globalThis.document.documentElement.scrollWidth <=
            globalThis.innerWidth,
        ),
      ).toBe(true);
      await page.getByRole('button', { name: 'Back to project' }).click();
      await expect(page).toHaveURL(/projects\/p100$/);
    }
  }
  const unexpected = errors.filter(
    (message) => !message.includes('Intentional routing example failure'),
  );
  expect(unexpected).toEqual([]);
  await mkdir('storage/documentation', { recursive: true });
  await writeFile(
    resolve('storage/documentation', `capture-${mode}.json`),
    JSON.stringify(
      {
        mode,
        entry: base.href,
        locale: 'en-US',
        viewport: { width: 1280, height: 800 },
        capturedAt: new Date().toISOString(),
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log(`Captured ${mode} scenarios in ${output}`);
} finally {
  await browser.close();
}
