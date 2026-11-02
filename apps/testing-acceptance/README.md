# Product acceptance

A runnable NocoBase 3 application for [Testing and acceptance](https://docs.nocobase.com/core/developing-apps/testing-and-acceptance/) ([中文](https://docs.nocobase.com/zh-CN/core/developing-apps/testing-and-acceptance/)). An editor creates a product draft and publishes it; a viewer reads and downloads permitted products. A local command exports the public catalog to JSON. The page, API, authentication, authorization and database are real.

This independent application reuses the Product Catalog example's template and server implementation. It adds a React management page, an export command, accounts for acceptance, and tests covering one business domain. No external model or messaging service is required.

## Requirements

Use Node.js 24 and pnpm 11.7.0. The lockfile pins the installed dependencies. Template baseline: `1.0.0-beta.85`; app-server `3.0.0-beta.5`, app-client `4.0.0-beta.5`, app-testing `0.1.0-beta.6`, Vitest `4.1.12`. SQLite is the provided and tested local configuration, not a general requirement for NocoBase testing. Other database drivers need their packages and configuration and have not been verified here.

## Install and run

Run from `apps/testing-acceptance`:

```bash
pnpm install --frozen-lockfile
pnpm setup
pnpm dev
```

`setup` writes a private `config.yml` with generated secrets and an administrator, installs the real database migrations and role Seeds, and creates two ordinary accounts with explicit role assignments. Read their email addresses and generated passwords in `storage/demo.json`; do not commit or share that file. Repeating setup keeps the existing accounts and configuration. It does not reset data. The initial product list is empty; create a product through the page.

Open the complete application entry printed by `pnpm dev`, retaining its base path, then choose **Products**. Use the `catalog-editor` account to create and publish; use `catalog-viewer` to inspect the read-only page and download CSV. Administrators can manage assignments through the registered user and permission settings. Setup creates no wildcard business assignments and does not extend the inherited member role.

For LAN use, supply your actual IP consistently when preparing and starting the application:

```bash
APP_PUBLIC_ORIGIN=http://<LAN-IP>:13320 pnpm setup
APP_SERVER_HOST=0.0.0.0 APP_SERVER_PORT=13320 \
  APP_PUBLIC_ORIGIN=http://<LAN-IP>:13320 pnpm dev
```

When using another public origin, configure `auth.trustedOrigins` in your private configuration for that origin too. Use the application server port, not the internal Vite port. Temporary review tunnel addresses are not maintained demo URLs.

## Use the application

At `/main/products` (adjust `/main` to your mount path), enter **Desk organizer** and **2400** cents. **Create draft** saves a draft. Reload to verify persistence, then choose **Publish** in its row. Publication remains visible after another reload and the product appears under **Public catalog**. **Download CSV** exports records allowed by the current account, including drafts; the anonymous public catalog lists only published products.

A viewer has no create form or publish button. Direct mutation requests from that same account are rejected by the server. The management page is available to signed-in users and uses `authz: 'skip'` for page navigation; the API still enforces business access, and an account without view permission receives an access message with no products.

The management page shows the first 50 products sorted by name. This deliberately small example has no management search or pagination. HTTP CSV and CLI JSON exports are bounded to 500 products. The CLI refuses larger exports rather than silently truncating them. Create and publish use the application's standard submission mechanism and server mutation receipts, so retrying the same operation key does not duplicate a successful write. Publishing an already published product with a new operation key is rejected.

Loading, empty, denied and failure states are handled by the page. Component tests and one browser test deliberately delay or fail HTTP responses to exercise recovery; the runnable application has no fake success endpoint or built-in failure switch.

## Run tests

Run the documentation's focused suite:

```bash
pnpm test:example
```

Or run one layer from the same application directory:

```bash
pnpm test --project client tests/client/product-form.test.tsx
pnpm test --project node tests/server/catalog.test.ts
pnpm test --project node tests/database/catalog.test.ts tests/database/catalog-data.test.ts
pnpm test --project node tests/cli/export.test.ts
```

The default `pnpm test`, `pnpm test:watch` and `pnpm test:coverage` include inherited template tests as well. `test:example` focuses on the documentation's business cases. Database fixtures own temporary databases and do not reset development data. CLI fixtures use the real runtime and app factory through static imports so Vitest can resolve TypeScript source, preserve isolated storage, and route application logging to stderr while stdout contains one JSON result.

For browser tests, first start a dedicated test instance and run setup in it. The cases read only its local `storage/demo.json` for the generated editor and viewer accounts:

```bash
pnpm exec playwright install chromium
APP_URL=http://<host>:13320/main \
  pnpm test:e2e tests/playwright/products.test.ts
```

`APP_URL` is required; missing accounts or configuration fail rather than silently skipping. Browser tests create uniquely named products and retain them for inspection. They are intended for a dedicated instance, not production. To write English full-viewport screenshots, add `SCREENSHOT_DIR=/path/to/output`. The suite checks a real form submission, publication, reload persistence, viewer denial at both UI and API, CSV download, and recovery from an injected temporary HTTP failure.

## Export from the command line

Stop the application before starting this command against the same local storage: the template's background workers use in-process configuration, and this example is intended for one application process at a time.

```bash
pnpm nocobase app products export --output ./products.json --dry-run --json
pnpm nocobase app products export --output ./products.json --json
```

The parent directory must exist. The command exports only published products using the same public read policy as the anonymous catalog. It is a local operator command, not an authenticated HTTP endpoint. It never overwrites an existing file. The dry run returns a count without writing. The normal result has `ok: true` and `result.written: true`; a write failure has a nonzero exit and `EXPORT_WRITE_FAILED`. `withApp()` shuts down the application after success or failure.

## Documentation-to-code map

| Documentation usage          | Entry                                 | Source                                                                                                           | Expected result                                                                               |
| ---------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Client requests and feedback | Create draft                          | `client/pages/products/form.tsx`, `tests/client/product-form.test.tsx`                                           | Correct payload; success clears input; failures preserve it; pending submission cannot repeat |
| Real APIs and permissions    | `/api/products`, `/api/catalogAccess` | `server/routes/products.ts`, `tests/server/catalog.test.ts`                                                      | Anonymous 401, denied 403, permitted writes persist; scoped records remain inaccessible       |
| Migrations and initial data  | Database and server tests             | `database/main/migrations/202610310001_create_catalog.ts`, `database/main/seeds/202610310002_catalog_samples.ts` | Apply/rollback/reapply; repeated sample execution preserves edited records                    |
| Constraints and rollback     | Database tests                        | `tests/database/catalog-data.test.ts`                                                                            | Duplicate primary key rejected; failed transaction leaves no partial row                      |
| CLI output and cleanup       | `app products export`                 | `cli/commands/products/export.ts`, `tests/cli/export.test.ts`                                                    | Published-only output; dry run writes nothing; existing file survives failure                 |
| Browser acceptance           | `/main/products`                      | `tests/playwright/products.test.ts`                                                                              | Draft and publication survive reload; viewer cannot mutate; retry recovers                    |

## Verification

Validated on Linux, Node 24, SQLite, Chromium and the lockfile above. The focused suite passed 15 cases; additional route-title, locale-coverage and authorization-assignment checks passed 14 cases. Type checking, scoped ESLint, formatting, the deployment build, setup, an actual CLI export and dry run, and three browser acceptance cases against the built application were run through both LAN and a temporary HTTPS tunnel. Screenshots include draft, published, read-only, failed and pending states. Other database dialects, other browser engines and multi-process operation were not verified.

The deployment build is also supported with `pnpm build`. Local review of the built app used `pnpm start` with `APP_CONFIG_FILE` and `APP_STORAGE_DIR` pointing to the source application's private configuration and storage. Supply those paths explicitly if you want to reuse the same data. See the template's `README.MD` for general deployment details.
