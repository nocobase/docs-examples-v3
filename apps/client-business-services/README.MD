# Client services

A runnable companion to [Client services](https://docs.nocobase.com/core/developing-apps/client-business-services/)
([中文](https://docs.nocobase.com/zh-CN/core/developing-apps/client-business-services/)).
Rename products through a shared client service, observe two React subscribers,
and refresh a list through a separate change subscription.

## Requirements and setup

- Node.js 24 or newer and pnpm 11 (`packageManager`: `pnpm@11.7.0`).
- Default application template `1.0.0-beta.85`.
- The committed lockfile pins `@nocobase/app-client` `4.0.0-beta.5`,
  `@nocobase/service-provider` `0.0.2-beta.2`, and
  `@nocobase/app-server` `3.0.0-beta.5`, along with the template plugins.
- No external services or account are needed for the product demonstration.

Run from this application's directory:

```bash
pnpm install --frozen-lockfile
pnpm nocobase config init --dialect sqlite --json
pnpm nocobase config check --json
pnpm dev
```

Append `service-products` to the application base URL printed by the server.
For a base ending in `/main/`, the page is `/main/service-products`.
For LAN access, set `APP_SERVER_HOST=0.0.0.0` and open the machine's current
LAN address at the printed port, retaining the base path.

SQLite runs the template's standard capabilities in this standalone example.
The client service itself has no database requirement. Existing applications
keep their own configuration; do not copy this example's local `config.yml`.

## What the example does

The intentionally public `/api/clientServiceProducts` API exposes exactly three
fictional products. Renaming changes server memory only. Reloading the browser
retains the names but creates a fresh client service with a zero counter;
restarting the server restores the original names.

The editor owns its draft, pending state and AbortController. A successful
service call increases its revision and notifies subscribers. The list uses
`useListData` to refetch; the two counters use `useSyncExternalStore`. The service
does not cache list rows or receive changes from other tabs or users.

**Response mode** controls an example-specific header:

- **Normal** saves and responds immediately.
- **Fail** returns an HTTP 503 without changing a product. The editor keeps its draft.
- **Slow (3 seconds)** changes the record immediately, then delays the response.
  Cancel the request and use **Refresh list** to see why aborting a client request
  does not undo a server mutation.

**Hide second view** unmounts one subscriber. Saving still updates the other.
**Show second view** mounts it again and immediately reads the latest snapshot.

This disposable API is not a production catalog. It has no business authorization
or database persistence and never accesses user records. Do not mount its route
contribution in a business application; use that application's real endpoint
security and data access. Its bounded input validation and in-memory store are
part of the demonstration, not a substitute for permissions.

## Documentation usage map

| Usage                           | Operation or command                       | Source                                                                            | Observable result and verification                                                                      |
| ------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Token and lazy singleton        | Run `products-service.test.ts`             | `client/services/tokens.ts`, `client/providers/products.ts`                       | Same container shares one instance; separate containers do not; unused shutdown creates no instance     |
| API Client injection and rename | Edit a product and save                    | `client/services/products.ts`, `client/pages/service-products/editor.tsx`         | Real PATCH request, returned product name, both counters increase; `saved.png`                          |
| Failure and draft retention     | Choose Fail and save                       | `server/routes/demo-products.ts`, `client/pages/service-products/editor.tsx`      | HTTP 503, draft retained, no success notification; `failed.png`                                         |
| Cancellation                    | Choose Slow, save, then Cancel request     | `client/pages/service-products/editor.tsx`                                        | Pending inputs disabled; cancel restores editing; no revision increment; `pending.png`, `cancelled.png` |
| React external state            | Save with both counters visible            | `client/hooks/use-product-revision.ts`, `client/pages/service-products/index.tsx` | Two subscriptions show the same revision; `saved.png`                                                   |
| List invalidation               | Save, or use Refresh list after cancelling | `client/hooks/use-products.ts`, `client/hooks/use-list-data.ts`                   | Initial load, subscribed refetch and cancellation of obsolete reads; `saved.png`, `cancelled.png`       |
| Unsubscription                  | Hide second view, save, show it again      | `client/pages/service-products/index.tsx`                                         | Remaining counter updates; remounted counter reads current snapshot; `unmounted.png`                    |
| Disposal                        | Run `products-service.test.ts`             | `client/providers/products.ts`, `client/services/products.ts`                     | Listeners cleared, late responses do not notify, no construction at unused shutdown                     |
| HTTP data boundary              | Run `demo-products.test.ts`                | `server/providers/demo-products.ts`, `server/routes/demo-products.ts`             | Fixed IDs and bounded names; independent router stores; anonymous access is intentional                 |

The browser suite writes full-viewport screenshots under `storage/screenshots/`.
The documentation publishes English captures in `assets/core/client-services/`
and reuses them in both languages.

## Checks

From this application directory:

```bash
pnpm exec vitest run tests/client/products-service.test.ts tests/client/service-products.test.tsx tests/server/demo-products.test.ts tests/client/client-routes.test.ts tests/client/app-locale-coverage.test.ts tests/client/page-permission-titles.test.ts
pnpm exec tsc --noEmit
pnpm exec tsc -p tsconfig.server.json --noEmit
pnpm exec tsc -p tsconfig.node.json --noEmit
pnpm build
```

Against a running application, install Chromium once if needed, then set
`DEMO_URL` to its base URL (without a trailing slash):

```bash
pnpm exec playwright install chromium
DEMO_URL=<application-base-url> pnpm exec playwright test tests/playwright/client-services.test.ts
```

`CHROMIUM_PATH` optionally selects an existing Chromium executable;
`SCREENSHOT_DIR` changes the output directory. The suite edits only the fictional
lamp record. Restart the example server to restore all three products.

## Validation record

Validated on Linux x64, Node.js 24 and pnpm 11.7.0 with the committed lockfile:

- Six focused Vitest files: 24 tests passed (services, UI, API, routes and locales).
- Client, server and tooling TypeScript checks passed.
- Lint and formatting passed for feature source and tests; the UI component
  checker scanned both page files with no findings.
- Full application build passed, including server dependency verification.
- Chromium checked successful saving, failure recovery, cancellation after the
  server mutation, subscriber unmount/remount, page reload and a 375px viewport.
- Dark-mode Chinese rendering and keyboard focus after invalid submission were
  checked separately. Documentation screenshots use English.

No production deployment, business authorization, database-backed product data,
multi-user synchronization or server rendering was implemented or verified.
