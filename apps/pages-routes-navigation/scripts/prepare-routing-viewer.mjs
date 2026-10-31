import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

// Creates only demonstration-owned records through authenticated application APIs.
const entry = process.env.APP_URL;
if (!entry || !process.env.E2E_USERNAME || !process.env.E2E_PASSWORD)
  throw new Error(
    'Set APP_URL, E2E_USERNAME and E2E_PASSWORD for the demonstration administrator.',
  );
const base = new URL(`${entry.replace(/\/+$/, '')}/`);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ locale: 'en-US' });
  await page.goto(new URL('login', base).href);
  await page.getByLabel('Username or email').fill(process.env.E2E_USERNAME);
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'));
  const suffix = randomBytes(3).toString('hex');
  const key = `routing-viewer-${suffix}`;
  async function post(path, data) {
    const response = await page.request.post(
      new URL(`api/${path}`, base).href,
      {
        headers: {
          Origin: base.origin,
          'Idempotency-Key': `${Date.now()}.${randomUUID()}`,
        },
        data,
      },
    );
    if (response.status() !== 201)
      throw new Error(`${path}: ${response.status()} ${await response.text()}`);
    return (await response.json()).data;
  }
  await post('authorization/permissionSets', {
    key,
    title: 'Project viewer',
    grants: [
      {
        resource: { type: 'page', id: 'projects' },
        actions: [{ action: 'access' }],
      },
    ],
  });
  const username = `route.viewer.${suffix}`;
  const password = randomBytes(24).toString('base64url');
  const user = await post('users', {
    name: 'Project Viewer',
    username,
    email: `${username}@example.com`,
    password,
    roleScopes: { app: [key] },
  });
  expect(user.id).toEqual(expect.any(String));
  await mkdir('storage/documentation', { recursive: true });
  await writeFile(
    'storage/documentation/viewer.json',
    JSON.stringify({ username, password, userId: user.id, roleKey: key }),
    { mode: 0o600 },
  );
  console.log(
    'Created Project Viewer with only projects/access. Credentials: storage/documentation/viewer.json',
  );
} finally {
  await browser.close();
}
