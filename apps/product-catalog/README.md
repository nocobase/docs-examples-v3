# Product Catalog

A runnable companion to [HTTP routes and APIs](https://docs.nocobase.com/core/developing-apps/apis-and-services/) ([中文](https://docs.nocobase.com/zh-CN/core/developing-apps/apis-and-services/)).

Compare server-rendered Web routes, custom JSON APIs and Repository data endpoints in one application. Products and categories use a real database; the native authentication and authorization plugins protect management operations and downloads. The public catalog is a server-rendered HTML page, not a React page route.

## Requirements

- Node.js 24 or later and pnpm 11.7.0.
- Default template `1.0.0-beta.85`. The lockfile resolves `@nocobase/app-server` `3.0.0-beta.5`, `@nocobase/app-client` `4.0.0-beta.5`, `@nocobase/db` `1.0.0-beta.24` and `@nocobase/app-plugin-authorization` `1.0.0-beta.33`.
- SQLite is the self-contained setup below. No external service is needed. Other supported database drivers are configuration choices, not requirements of HTTP routing; they have not been verified for this example.

## Run

From `apps/product-catalog`:

```bash
pnpm install --frozen-lockfile
pnpm nocobase config init --dialect sqlite
pnpm nocobase config check
APP_SAMPLE_DATA=true pnpm dev
```

Before the first startup, configure the administrator in local `config.yml` under `users.initialAdmin`. Keep that file private. Use the complete application address printed by `pnpm dev`, including its mount path, rather than Vite's internal port.

For LAN access, choose free ports and your machine's actual address:

```bash
APP_SERVER_HOST=0.0.0.0 APP_SERVER_PORT=13250 \
APP_PUBLIC_ORIGIN=http://<your-lan-ip>:13250 \
APP_BASE_PATH=/shop APP_SAMPLE_DATA=true pnpm dev
```

In the descriptions below, `APP_URL` is the application address including its mount path and with no trailing slash. For example, a `/shop` mount means the public catalog is `/shop/catalog` and the product API is `/shop/api/products`.

`APP_SAMPLE_DATA=true` installs two published products (Canvas Backpack, Desk Lamp), one draft (Travel Mug), and two public categories (Office, Travel). It runs once during first installation and does not reset records on restart. If samples were skipped at installation, `pnpm nocobase db sample` installs them in development. Stored changes survive reloads and restarts.

## Access and permissions

- `/catalog`, `/old-catalog` and `/api/publicCategories/*` are intentionally public. The catalog only reads published products. Categories return only `id` and `title`, never `internalNote`.
- Product APIs and `/catalog/export.csv` require a native login session. Scoped API keys are disabled on these management routes.
- The **Catalog viewer** role can read permitted products and download them; **Catalog editor** can also create and publish. Initial roles select all records. Roles are not assigned to ordinary users automatically.
- Administrators use the registered **Users** and **Permission management** pages to assign roles to explicit users and edit actions and record scopes. The platform's inherited member role remains unchanged. Page access and business actions are independent.
- CSV uses the caller's view scope, including drafts where permitted. It is not the public catalog's published-only feed. It is bounded to 500 records and generated in memory; the HTML page shows at most 50 published records. Use batching/streaming for larger exports.

## Usage map

| Documentation usage              | Entry or command                                                        | Source                                                                                                               | Observable result and verification                                                                    |
| -------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Registration                     | Start the app                                                           | `server/routes/index.ts`, `server/providers/index.ts`                                                                | All contributions are registered; real application tests                                              |
| Root HTML                        | Open `$APP_URL/catalog` anonymously                                     | `server/routes/catalog-web.ts`, `server/providers/catalog-service.ts`                                                | Two published sample products, no draft; `catalog-web.png`, server/browser tests                      |
| Application mount path           | Run with `APP_BASE_PATH=/shop`                                          | `server/routes/catalog-web.ts`                                                                                       | HTML links retain `/shop`; server tests run at this mount                                             |
| Redirect                         | `curl -i "$APP_URL/old-catalog"`                                        | `server/routes/catalog-web.ts`                                                                                       | 302, mount-aware `Location`; browser follows it to the catalog                                        |
| Download                         | Sign in, then click **Download CSV**                                    | `server/routes/catalog-web.ts`                                                                                       | `products.csv`, CSV content type and attachment header; server/browser tests                          |
| Query parameters                 | Swagger → Products → List products; `q=Desk`, `page=1`, `pageSize=10`   | `server/routes/products.ts`, `server/providers/catalog-service.ts`                                                   | Desk Lamp with page, pageSize and total; real policy-bound queries                                    |
| Path parameters                  | Get a product using an ID from the list                                 | `server/routes/products.ts`                                                                                          | 200 `{ data }`, invalid UUID 400, missing/out-of-scope ID 404                                         |
| JSON request body                | Create a draft with `{ "name": "Travel Notebook", "priceCents": 1200 }` | `server/routes/products.ts`                                                                                          | 201, persisted unpublished record; invalid input writes nothing                                       |
| Service call                     | Publish the new product with `{}`                                       | `server/providers/catalog-service.ts`, `server/providers/catalog.ts`                                                 | 200 and visible in public catalog; new operation on published record gives 409                        |
| Mutation receipts                | Resend create/publish with the same operation key and input             | `server/routes/products.ts`                                                                                          | `Idempotency-Replayed: true`, no duplicate effect; server tests                                       |
| Repository actions and fields    | POST `$APP_URL/api/publicCategories/findMany`, body `{ "limit": 20 }`   | `server/routes/categories.ts`                                                                                        | Public categories without internalNote; limit above 50 fails, writes are not registered               |
| API Client                       | `loadCategories(api)`; `count()` and `findOne()` in the test            | `client/catalog-api.ts`, `tests/server/catalog.test.ts`                                                              | Array/count/record results rather than HTTP envelopes                                                 |
| Authentication and authorization | Ordinary account with no role, viewer role, then revoked grant          | `server/routes/catalog-access.ts`, `server/catalog-resource.ts`, `database/main/seeds/202610310001_catalog_roles.ts` | 401/403; row scope applies to lists, count, details and CSV; real permission service tests            |
| API documentation                | Sign in and open `$APP_URL/api/swagger/docs`                            | `server/routes/products.ts`                                                                                          | Products group, input schemas, header and responses; `catalog-api.png`; no root Web routes in OpenAPI |
| Schema lifecycle                 | Run migration test                                                      | `database/main/migrations/202610310001_create_catalog.ts`, `tests/database/catalog.test.ts`                          | Create, rollback and reapply on an isolated database                                                  |

The database, routing, authentication and authorization APIs come from NocoBase packages. `CatalogService`, `productPolicy`, `toCsv`, the Product schema, the role definitions and `loadCategories` are application-owned example code. HTML labels and role titles use the application's English/Chinese locales; demonstration records remain English.

### Create and publish

Sign in, then use **Try it out** and **Execute** in the API documentation. Both writes require `Idempotency-Key` in the form `<13-digit Unix milliseconds>.<UUID v4>`:

```bash
node -e 'console.log(`${Date.now()}.${require("node:crypto").randomUUID()}`)'
```

Use the same key and input to retry an operation whose result is unknown; a successful replay returns the original result. Use a new key for another intentional operation. The route explicitly integrates `executeIdempotentMutation` and passes its transaction into the service. The header alone does not make arbitrary custom routes idempotent. Receipts use the template's 24-hour retry window and check current authorization before replay. This sample has no external side effects or cross-database writes.

Creating a product never publishes it. Publication is a single conditional database update, not a configurable approval workflow. A repeated publication using a new key returns `PRODUCT_ALREADY_PUBLISHED`; invalid input, denied permissions and failed writes leave no committed mutation receipt.

## Verify

```bash
pnpm exec vitest run tests/server/catalog.test.ts tests/database/catalog.test.ts tests/server/authorization-assignment-safety.test.ts
pnpm exec vitest run tests/client/client-routes.test.ts tests/client/page-permission-titles.test.ts
pnpm exec tsc -p tsconfig.server.json --noEmit
pnpm exec tsc --noEmit
pnpm build
```

The server tests use real application startup, SQLite, native login and the permission service, with no substituted authentication or database. They test anonymous and denied requests, scoped reads/counts/downloads, revocation, input validation, HTML escaping, idempotent writes and OpenAPI registration. The migration test checks its physical fields and reversibility. Existing assignment-safety tests ensure installation grants no hidden wildcard business roles.

For browser checks, start a dedicated example instance with sample data and supply `APP_URL`, `E2E_USERNAME` and `E2E_PASSWORD` through your local environment. `SCREENSHOT_DIR` optionally writes the two English documentation images. These credentials are never committed or printed. Then run:

```bash
pnpm exec playwright test tests/playwright/catalog.test.ts
```

Install Chromium with `pnpm exec playwright install chromium` if needed. Browser tests skip when required configuration is absent; a skipped test is not validation. Screenshots capture the full 1280 × 800 viewport, without cropping or full-page stitching, and are shared by the Chinese and English articles in the website repository. The public page is also checked at 375 px.

Verified on Linux x64, Node 24.21.0, pnpm 11.7.0, SQLite and Chromium: frozen-lockfile installation, configuration validation, scoped ESLint and Prettier checks, server and client type checks, 20 tests across the five listed Vitest suites, two browser scenarios and a production build. The browser scenarios cover 1280 px and 375 px layouts, mounted redirects, native sign-in, Swagger and a real CSV download. Other database engines, browsers and multi-process publication races were not verified.

## Upgrade

Use this application's `nocobase-app-upgrade` Skill to reconcile a newer template. Preserve the catalog routes, service, policies, schema history, samples, registered management routes, template submission provider and custom tests. Do not replace application source wholesale.
