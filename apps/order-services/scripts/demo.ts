import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import type { createFixtures } from './fixtures.js';
const data = JSON.parse(await readFile('storage/demo.json', 'utf8')) as Awaited<
  ReturnType<typeof createFixtures>
>;
const origin = process.env.APP_PUBLIC_ORIGIN ?? 'http://localhost:13210';
const base = `${origin}/main/api`;
async function login(email: string) {
  const response = await fetch(`${base}/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ email, password: data.password }),
  });
  assert.equal(response.status, 200, 'Sign in');
  return response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
}
const buyer = await login(data.buyer.email);
const reader = await login(data.reader.email);
async function confirm(id: string, cookie: string, expected: number) {
  const response = await fetch(`${base}/orders/${id}/confirm`, {
    method: 'POST',
    headers: { cookie, origin },
  });
  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(response.status, expected, JSON.stringify(body));
  console.log(JSON.stringify({ status: response.status, ...body }));
}
await confirm(data.orders.http, buyer, 200);
await confirm(data.orders.http, buyer, 200);
await confirm(data.orders.shortage, buyer, 409);
await confirm(data.orders.other, buyer, 404);
await confirm(data.orders.reader, reader, 403);
const response = await fetch(`${base}/orders/${data.orders.job}/confirmAsync`, {
  method: 'POST',
  headers: { cookie: buyer, origin },
});
assert.equal(response.status, 202);
console.log(JSON.stringify(await response.json()));
const deadline = Date.now() + 10000;
while (true) {
  const current = await fetch(`${base}/orders/${data.orders.job}`, {
    headers: { cookie: buyer },
  });
  const body = (await current.json()) as { data?: { status: string } };
  if (body.data?.status === 'confirmed') {
    console.log(JSON.stringify(body));
    break;
  }
  if (Date.now() > deadline)
    throw new Error('Background confirmation timed out.');
  await new Promise((resolve) => setTimeout(resolve, 50));
}
