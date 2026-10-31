# Customer Directory

A runnable companion to [Data requests and state](https://docs.nocobase.com/core/developing-apps/data-requests-and-state/) ([中文](https://docs.nocobase.com/zh-CN/core/developing-apps/data-requests-and-state/)).

Search, paginate, view, create, edit, and delete fictional customers using real application APIs and persistence. Read controls introduce delays and failures; write controls reject a write before saving or lose its response after the real transaction commits. These controls exercise the actual client hooks and standard mutation receipts.

## Requirements

- Node.js 24 or later; pnpm 11.7.0, selected by `packageManager`.
- Default template `1.0.0-beta.85`. The lockfile resolves `@nocobase/app-client` `4.0.0-beta.5`, `@nocobase/app-server` `3.0.0-beta.5`, and `@nocobase/app-plugin-authorization` `1.0.0-beta.33`.
- No external service is needed for the SQLite setup below. Other database configurations are not prerequisites for these APIs and were not validated for this example.

## Run

From this directory:

```bash
pnpm install --frozen-lockfile
pnpm nocobase config init --dialect sqlite
pnpm nocobase config check
APP_SAMPLE_DATA=true CUSTOMER_DEMO_FAULTS=1 pnpm dev
```

`config init` generates local `config.yml`; configure `users.initialAdmin` there and sign in with that account. Keep the file private. Open the application address printed at startup and choose **Customer directory**, or append `/customers` to its mount path. Do not use Vite's internal port as the application address.

For LAN access, supply your machine's address and a free application port, for example:

```bash
APP_SERVER_HOST=0.0.0.0 APP_SERVER_PORT=13248 \
APP_PUBLIC_ORIGIN=http://<your-lan-ip>:13248 \
APP_SAMPLE_DATA=true CUSTOMER_DEMO_FAULTS=1 pnpm dev
```

Use the host and port you configured, together with the mount path printed by the application. The default mount path is `/main`, but an existing environment can override it.

`APP_SAMPLE_DATA=true` installs 23 English sample customers once. Saved changes survive page reloads and server restarts; startup does not restore edited or deleted records. `CUSTOMER_DEMO_FAULTS=1` enables only the extra delays and fault injection. Without it, normal reads and writes still work; requesting a write fault gives an explanatory error.

## Permissions

The native **Users** and **Permission management** pages are registered. Installation creates two editable business roles without assigning them automatically:

- **Customer viewer** (`customer-viewer`): customer page access and the `customers/view` business action.
- **Customer editor** (`customer-editor`): page access plus view, create, edit, and delete actions.

Assign a role to a specific ordinary user through **Users**. Page access and data actions are independent. The initial roles select all fictional customer records; no ownership or organization model is claimed. Administrators can edit business grants and scopes in the standard permission UI.

For the revocation demonstration, assign only the viewer role to a test user, open the list as that user, then remove its customer view action while retaining page access. Clicking **Refresh** must produce 403 and clear the visible records. Restore the grant afterward. The browser test creates its own user and role for this check and removes them when finished.

## Usage map

Screenshots live in the website repository at `doc/public/assets/core/developing-apps/data-requests-and-state/`. `SCREENSHOT_DIR` regenerates them from the real application; the same English images are used by both article languages.

| Documentation usage                | Application entry                                                      | Source                                                                   | Screenshot or output                                      | Expected behavior and check                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| API Client business reads          | Click Alpine Goods                                                     | `client/pages/customers/detail.tsx`, `server/routes/customers.ts`        | `detail.png`                                              | GET record is rendered in a route drawer; browser test                                            |
| Repository writes                  | Detail → Edit customer                                                 | `client/pages/customers/api.ts`                                          | `edit.png`                                                | POST update changes the real record; server and browser tests                                     |
| `useListData` and refresh          | Customer directory → Refresh                                           | `client/pages/customers/use-customer-list.ts`                            | `list.png`                                                | Current query is reloaded; component and browser tests                                            |
| URL search, page size, sorting     | Search Al, Active, five rows, descending name                          | `client/hooks/use-table-url-state.ts`                                    | `query.png`                                               | URL retains conditions through reload and overlays                                                |
| Covered list and child return      | Detail → Edit → Save → Close                                           | `client/hooks/use-list-location.ts`, `client/pages/customers/context.ts` | `detail.png`, `edit.png`                                  | List pauses underneath the overlay, then restores its query                                       |
| Loading / refresh / no results     | Request demonstrations → Slow response; Refresh; search NoSuchCustomer | `client/pages/customers/index.tsx`                                       | `loading.png`, `refreshing.png`, `empty.png`              | Loading differs from empty; same-query refresh keeps rows                                         |
| Out-of-order reads                 | Out-of-order responses; search A then Al quickly                       | `client/hooks/use-list-data.ts`                                          | `query.png`; `tests/client/customers.test.tsx` assertions | Old response cannot replace current results, even when resolved last                              |
| Read failure and retry             | Read failure → Retry                                                   | `server/routes/customers.ts`                                             | `read-error.png`                                          | Intentional 503; retry resets read mode; same-query refresh failure retains rows                  |
| Permission changes                 | Viewer account + revoke business view grant                            | `server/customer-resource.ts`, `server/providers/customers.ts`           | `permission.png`                                          | Native 403 clears old rows and denies direct API access                                           |
| Submission protection              | Slow submission; repeated clicks or form submits                       | `client/pages/customers/edit.tsx`, `server/providers/submission.ts`      | `submitting.png`                                          | One request while busy; committed operation has one receipt                                       |
| Rejected draft                     | Reject before saving                                                   | `client/pages/customers/edit.tsx`                                        | `draft.png`                                               | 400 before write, unchanged fields, zero new rows                                                 |
| Unknown outcome and recovery       | Lose response after saving → Retry original submission                 | `client/pages/customers/edit.tsx`, `server/routes/customers.ts`          | `uncertain.png`; `Idempotency-Replayed: true`             | Same operation key, one database row; browser test also reloads and re-enters the original values |
| Saved details and list             | Edit a contact from its detail drawer                                  | `client/pages/customers/detail.tsx`                                      | `saved-detail.png`                                        | Detail and list refresh independently from the successful write                                   |
| Delete on last page                | Six matching customers, five rows per page, delete the sixth           | `client/pages/customers/delete.tsx`, `use-customer-list.ts`              | `delete.png`, `corrected-page.png`                        | New total corrects page without losing filters or sorting                                         |
| Dirty-editor close and narrow view | Edit a field, Cancel, Keep editing                                     | `client/pages/customers/use-editor-leave.tsx`                            | `mobile.png`                                              | Guard preserves the draft; dialog fits narrow and dark displays                                   |

`useListData`, `useListLocation`, and `useTableUrlState` are template-owned application source, not package exports. `useSubmission` and `useApiClient` are framework exports. Customer routes, permissions, fault controls, and form orchestration are example code.

The one-shot write fault is scoped to the authenticated user and operation key and expires after five minutes. `lose` runs after the standard mutation and receipt have committed, then returns 503. Recovery skips rearming the fault and sends the original operation again. The demo uses one process for fault injection; the in-memory fault switch is not a distributed failure simulator.

The form keeps drafts in memory. Submission recovery stores only an operation key and input digest in the browser tab's session storage, not the field values. After reloading an unresolved form, enter the original values exactly. A different payload cannot silently create another operation. Custom effectful business endpoints need explicit receipt transaction integration; the standard Repository provider does not make every POST idempotent.

## Verify

```bash
pnpm exec vitest run tests/client/customers.test.tsx tests/client/client-routes.test.ts tests/client/page-permission-titles.test.ts tests/client/list-recovery.test.tsx tests/client/table-url-state.test.tsx tests/server/customers.test.ts tests/server/authorization-assignment-safety.test.ts tests/database/customers.test.ts
pnpm typecheck
pnpm build
```

The new page tests use the real page and hooks with controlled HTTP responses. Server tests boot the application on an isolated database. Migration verification applies, rolls back, and reapplies the customer migration.

To run browser verification, start the example with sample data and fault controls as above, install Chromium if needed (`pnpm exec playwright install chromium`), and provide these environment variables through your terminal or local secret configuration:

- `APP_URL`: the actual application address including its mount path, without `/customers` or `/api`.
- `E2E_USERNAME`, `E2E_PASSWORD`: an administrator of this dedicated example instance.
- `SCREENSHOT_DIR` (optional): an output directory such as `storage/documentation`.

Then run:

```bash
pnpm exec playwright test tests/playwright/customers.test.ts
```

The browser suite creates and removes its own customer records, user, and permission set. It temporarily changes Alpine Goods' contact and restores the original record. Use a dedicated example instance. Without the required environment variables, browser tests skip; a skipped run is not verification.

Verified on Linux x64, Node 24.21.0, pnpm 11.7.0, SQLite, and Chromium: frozen-lockfile installation, configuration validation, relevant lint/format/type checks, 40 tests across eight focused Vitest files, production build, six browser scenarios (including a focused recheck of permission changes and language switching), English/Chinese copy, light/dark appearance, and a 375 px layout. Other database engines, browsers, and distributed fault injection are not verified. Application cookies, local configuration, databases, traces, and generated screenshots are not committed here.

## Upgrades

This application was generated from default template `1.0.0-beta.85`. Use the application-local `nocobase-app-upgrade` Skill for version selection and three-way source reconciliation. Preserve the customer routes, business grants, data, executed migrations, template submission provider, and custom page tests when upgrading.
