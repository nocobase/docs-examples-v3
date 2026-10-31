import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createApiClient } from '@nocobase/api-client';
import type { createFixtures } from './fixtures.js';

export async function demoSession(role: 'editor' | 'reader' = 'editor') {
  const data = JSON.parse(
    await readFile('storage/demo.json', 'utf8'),
  ) as Awaited<ReturnType<typeof createFixtures>>;
  const origin = process.env.APP_PUBLIC_ORIGIN ?? 'http://localhost:13220';
  const baseURL = `${origin}/main/api`;
  const response = await fetch(`${baseURL}/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ email: data[role].email, password: data.password }),
  });
  assert.equal(response.status, 200, 'Sign in');
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  const headers = { cookie, origin };
  return {
    api: createApiClient({ baseURL, headers }),
    baseURL,
    headers,
    ids: data.ids,
  };
}
