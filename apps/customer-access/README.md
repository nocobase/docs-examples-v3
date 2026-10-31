# Customer Access

Runnable companion to [Authentication, permissions and data scopes](https://docs.nocobase.com/core/developing-apps/authentication-and-permissions/) ([中文](https://docs.nocobase.com/zh-CN/core/developing-apps/authentication-and-permissions/)). Sales representatives maintain their own customers and change the customer on their orders. Read-only sales users can view their own records. Native authentication, authorization and Repository policies enforce every business endpoint.

## Requirements and setup

Use Node.js 24 and pnpm 11.7.0. This application was generated from `@nocobase/app-template-default@1.0.0-beta.85`. The lockfile fixes authentication `2.0.0-beta.16`, authorization `1.0.0-beta.33`, `@nocobase/db` `1.0.0-beta.24`, app-server `3.0.0-beta.5` and app-client `4.0.0-beta.5`.

From `apps/customer-access`:

```bash
pnpm install --frozen-lockfile
pnpm nocobase config init --dialect sqlite
pnpm nocobase config check
pnpm dev
```

Before first startup, set `users.initialAdmin.username`, `email` and `password` in local `config.yml`. Keep configuration, credentials and databases private. SQLite is the self-contained tested configuration, not an authentication requirement; other database engines have not been tested here. No external service is needed.

For review on your LAN, replace the host with your actual address and choose a free port:

```bash
APP_SERVER_HOST=0.0.0.0 APP_SERVER_PORT=13340 \
APP_PUBLIC_ORIGIN=http://<your-lan-ip>:13340 \
APP_BASE_PATH=/access pnpm dev
```

Use the complete application URL printed by the server, including the mount path. Vite's port is internal. Business routes never hard-code `/access`.

## Accounts, roles and sample records

The initial administrator uses **System settings → Users** to create named users. Assign **Sales representative** to one and **Read-only sales** to another. **Permission management → Roles and permissions** edits their page access, business actions and record scopes. Both roles initially select **Records I own**. No ordinary user receives a business role automatically; the platform `member` role remains unchanged.

After creating each user, add fictional records from the application directory:

```bash
pnpm nocobase app sample-customers --email alice@example.test --dry-run
pnpm nocobase app sample-customers --email alice@example.test
```

Replace the email with the actual account's email. The command adds Acme Supplies, Harbor Retail and order SO-1001 for that owner, skipping matching sample records on subsequent runs. It creates no accounts and assigns no roles. Run it for the second user to demonstrate scope isolation. These are stored records, not in-memory fixtures; changes survive reload and restart. The CLI is a trusted local operation for the application operator, not an end-user API.

## Operations and permissions

| Entry           | Endpoint                                                                                       | Action on `customerAccess` | Database capabilities                                                              |
| --------------- | ---------------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------- |
| Customers list  | `GET /customers`, `GET /customers/:id`                                                         | `viewCustomers`            | Read permitted customers; internalNote excluded                                    |
| New customer    | `POST /customers`                                                                              | `createCustomer`           | Create allowed fields; server supplies ID and authenticated owner                  |
| Edit customer   | `GET /customers/:id/editData`, `PATCH /customers/:id`                                          | `editCustomer`             | Read permitted customer; update name, email and notes only                         |
| Orders list     | `GET /orders`, `GET /orders/:id`                                                               | `viewOrders`               | Read permitted orders                                                              |
| Change customer | `GET /orders/:id/assignment`, `GET /orders/customerOptions`, `POST /orders/:id/assignCustomer` | `assignCustomer`           | Update permitted order's customerId and independently read the selectable customer |

API paths are relative to the app's `/api` prefix. Lists accept `page`, `pageSize` (maximum 50), `q` and `descending`; rows and totals use the same filter and policy. Assignment options paginate at 20 records in the UI and search within the currently loaded page. Orders show their number; customer names are loaded through the separately authorized assignment picker, not through an unrestricted join.

Page permissions `customerAccess.customers` and `customerAccess.orders` remain separate from business actions. Child dialogs inherit their parent's page access and check their own action before loading current records. Role configuration selects actions and scopes; field capabilities are code-owned. The creation scope selector is hidden in the editor without changing stored grants.

Missing and hidden customers/orders return the same 404 on record endpoints. A nonexistent or unselectable assignment target returns 400 `CUSTOMER_UNAVAILABLE`, preserving the old association. Missing required policies are rejected with 403. Strict HTTP schemas reject extra ownership/internal-note fields, while Repository separately rejects writes outside its policy. No generic customer/order write API bypasses these business operations.

Writes require `Idempotency-Key` (`<13-digit Unix milliseconds>.<UUID>`). The forms use `useSubmission`; custom routes use `executeIdempotentMutation` and the supplied transaction. A replay checks current authorization and result visibility. The key is not authorization. Cross-database transactions, external side effects and concurrent ownership changes are outside this example.

## Documentation usage map

| Usage                                            | Entry or command                                             | Source                                                                                 | Observable result / verification                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Authentication and current user                  | Anonymous `GET /customers`; create while signed in           | `server/routes/customer-access.ts`                                                     | 401 anonymously; created owner matches verified session                                             |
| Composite and field declaration                  | Read-only account, then Sales account                        | `server/access/permissions.ts`                                                         | Independent operations; internalNote absent; ownership update rejected                              |
| Multiple scopes                                  | Change customer from Orders                                  | `server/providers/customer-access-service.ts`                                          | Both order and target customer checked; failed changes leave data untouched                         |
| Registration and editor selection                | Edit the Sales representative role                           | `server/providers/customer-access.ts`, `client/pages/settings/permission-workspace.ts` | Five independent operations, two scopes for assignment; `permissions.png`                           |
| Conditional authorization / fail closed          | Run endpoint tests                                           | `server/access/authorize.ts`                                                           | Denied or missing policy rejected; isolated missing-policy case                                     |
| Owned records, query and count                   | Sign in as each ordinary user                                | `server/access/permissions.ts`, `server/providers/customer-access-service.ts`          | Only own rows and matching totals; `customers.png`                                                  |
| Create/edit                                      | Customers → New customer / row menu → Edit customer          | `client/pages/access/customer-form.tsx`                                                | Values persist on reload; `customer-create.png`, `customer-edit.png`; tests check idempotent create |
| Assignment options and persistence               | Orders → row menu → Change customer                          | `client/pages/access/assignment.tsx`                                                   | Scoped customer choices; saved association checked by a new read; `order-customer.png`              |
| Page and action separation                       | Page-only grant; action-only grant; read-only account        | `client/routes.ts`, `client/pages/access/list.tsx`                                     | Page access never grants API access; `customers-readonly.png`                                       |
| Installation and editable configuration          | New database, then role management                           | `database/main/seeds/202610310001_customer_access_roles.ts`                            | No wildcard assignment; no business grants in member; no boot-time overwrite                        |
| Schema lifecycle                                 | Run migration suite                                          | `database/main/migrations/202610310001_customer_access.ts`                             | Real schema creation, rollback and reapplication                                                    |
| Sample data                                      | `pnpm nocobase app sample-customers --email <existing-user>` | `cli/commands/sample-customers.ts`, `server/access/sample.ts`                          | Per-user persistent records; no account creation or role assignment                                 |
| Denied fields, independent scopes and revocation | Run endpoint suite                                           | `tests/server/customer-access.test.ts`                                                 | Unauthorized requests cannot mutate records; role revocation affects the next request               |

Screenshots live in the documentation repository at `doc/public/assets/core/developing-apps/authentication-and-permissions/`. They show the English application at the full 1280 × 800 viewport, shared by both article languages.

## Verify

```bash
pnpm exec vitest run tests/server/customer-access.test.ts tests/server/authorization-assignment-safety.test.ts tests/database/customer-access.test.ts tests/client/client-routes.test.ts tests/client/page-permission-titles.test.ts tests/client/app-locale-coverage.test.ts
pnpm exec tsc --noEmit
pnpm exec tsc -p tsconfig.server.json --noEmit
pnpm exec tsc -p tsconfig.node.json --noEmit
pnpm build
```

Server tests boot the real application, sign in ordinary users and execute policy-bound reads and writes against an isolated SQLite database. They cover 401/403, page-only API denial, row/count scopes, hidden fields, forbidden writes, assignment target checks, no partial writes, role revocation and idempotent replay. One isolated check supplies an incomplete authorization decision to exercise the fail-closed helper; it does not replace the real authorization tests. The initialized-assignment guard checks the actual database, including unchanged member grants and absence of wildcard business assignments.

Browser tests require a dedicated running instance, with the two named roles assigned and sample records installed as above. Create an untracked JSON file containing `alice`, `bob` and `admin`, each with `email` and `password` for your local test accounts; use an appropriately private location and file permissions. These are test fixture names, not account usernames the application requires. Never commit or print this file.

```bash
pnpm exec playwright install chromium
APP_URL=http://<your-lan-ip>:13340/access \
E2E_ACCOUNTS_FILE=/private/path/accounts.json \
SCREENSHOT_DIR=storage/ui-workflow/customer-access/screenshots \
pnpm exec playwright test tests/playwright/customer-access.test.ts
```

The browser suite uses native sign-in and actual endpoints, edits Acme Supplies, creates a customer and changes SO-1001's customer. Use disposable sample data. Missing environment variables skip these tests; a skip is not successful validation. Delete local credentials and session artifacts after verification.

Verified on Linux x64 with Node 24.21.0, pnpm 11.7.0, SQLite and Chromium: frozen installation, configuration validation, sample command preview/run, 24 tests across the six listed Vitest suites, seven Playwright scenarios, client/server/node type checks, scoped ESLint and Prettier, the component checker (eight files, no findings), and a production build. Browser checks include persistent create/edit/assignment, scoped read-only controls, denied requests, loading/failure states, stable dialogs, field error focus, preserved query strings, pagination correction, refresh feedback, terminal record errors and an IME search. Independent design and acceptance reviews were completed; reported pagination, dialog continuity, validation, error-state and local layout issues were fixed and rechecked. Other database engines, browsers, cross-process races and a live account-switch journey are not covered.

## Upgrade

Use the application's upgrade Skill for future template upgrades. Preserve the access resources, provider, business routes, collection migration, role seed, sample command, client pages, settings registration and tests. Keep the template's submission provider and native management surfaces.
