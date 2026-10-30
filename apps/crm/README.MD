# CRM — customer management

A runnable NocoBase 3 example for [Develop your first feature](https://docs.nocobase.com/core/getting-started/build-your-first-app/) / [开发第一个功能](https://docs.nocobase.com/zh-CN/core/getting-started/build-your-first-app/).

Customers have a name, contact details, notes, sales owner, next follow-up date and one of three statuses: Lead, Following up and Won. The application includes a searchable, filterable, paginated list, detail drawers, create/edit dialogs, and the template's user and permission management pages. English and Simplified Chinese are included.

## Run

Use Node.js 24 and pnpm 11.7.0. This example was created from `@nocobase/app-template-default@1.0.0-beta.85`; `pnpm-lock.yaml` fixes the installed dependencies, including `@nocobase/app-server@3.0.0-beta.5` and `@nocobase/app-client@4.0.0-beta.5`.

From this directory:

```bash
pnpm install --frozen-lockfile
pnpm nocobase config init --dialect sqlite --json
pnpm nocobase config check --json
pnpm dev
```

Open the complete address printed after `Local:`, including its application path. Startup applies the migrations and initial roles. Sign in with the initial administrator configured by the template (`nocobase` / `admin123` on a fresh default installation). Change the default password before sharing the application beyond a local demonstration.

For LAN access, detect your machine's LAN address, choose an available port, and set `app.publicOrigin` to that exact browser origin with `pnpm nocobase config set app.publicOrigin=http://<LAN-IP>:<PORT> --json`. Start with `APP_SERVER_HOST=0.0.0.0 APP_SERVER_PORT=<PORT> APP_BASE_PATH=/crm pnpm dev`. If the CLI selects a different port, update `app.publicOrigin` to match it. Keep the terminal running.

Local `config.yml`, secrets, databases, sessions, dependencies and build output are excluded from source distribution. The example uses SQLite; other database engines have not been verified for this example.

## Try the roles

In **System settings → Users**, create users and explicitly assign their **Permission sets**:

- **Sales manager**: view, create, edit, change status and delete every customer.
- **Sales rep**: view customers assigned to that user and update their status. No creation, detail editing or deletion.
- **Read-only user**: view every customer, without writes.

A user with none of these grants cannot access the customer feature. The administrator can edit the initial role grants in **Permission management**. Roles are not assigned to every authenticated user, and startup does not overwrite role changes.

Create a customer as a manager and select the sales rep as its owner. Sign in as that rep to verify the restricted list and status actions. The backend also checks direct requests; hiding an action is not the security boundary. The source archive starts without fictional customers or demo accounts.

## Implementation

- `database/main/migrations/202610300101_create_customers.ts`: customer schema and indexes.
- `database/main/seeds/202610300102_customer_roles.ts`: editable initial business roles.
- `server/customers/`: schemas, collection policies, row scopes and business service.
- `server/providers/customers.ts`: register the service and authorization resources.
- `server/routes/customers.ts`: authenticated HTTP APIs and OpenAPI declarations.
- `client/routes.ts`: customer child routes and prepared system settings.
- `client/pages/customers/`: table, detail drawer, form, owner picker and row actions.
- `client/locales/customers.ts`: English and Chinese text.
- `client/pages/settings/permission-workspace.ts`: expose the customer actions in the role editor.

The customer name is stored in `title`, notes in `description`, the owner in `salesOwnerId`, and the calendar date in `nextFollowUpDate`. Dates are `YYYY-MM-DD`. Mutations use operation receipts to protect retries and `expectedUpdatedAt` to reject stale changes. Editing details and changing status have separate permissions.

## Checks

```bash
pnpm exec vitest run tests/database/customers-migration.test.ts tests/server/customers.test.ts tests/server/authorization-assignment-safety.test.ts tests/client/customers.test.tsx tests/client/client-routes.test.ts tests/client/page-permission-titles.test.ts
pnpm typecheck
pnpm build
```

The targeted tests use isolated databases. They cover migration rollback/reapplication; authenticated CRUD; contact persistence; invalid dates; status and ownership restrictions; read-only writes; idempotent retry and revocation; stale updates; failed drafts; saved results after a failed list refresh; and registered route/permission labels.

For browser acceptance, run the app and check create, detail, edit, status change, refresh, search, filtering, pagination and deletion. Repeat with ordinary users holding only one of the roles above. Inspect both languages, mobile width and dark appearance. Backend and component tests do not replace those browser checks.

## Verification record — 2026-10-30

Verified with Node.js 24.21.0, pnpm 11.7.0 and SQLite on Linux:

- All 24 tests in the six targeted files above passed; type checking, the production build, package checks, feature ESLint and feature formatting checks passed. Collection metadata inspection reported no issues.
- In Chromium, an administrator created and edited a customer, chose its owner and follow-up date, changed status, and refreshed to confirm persistence. Search, combined search/status filtering and two-page pagination were exercised.
- A user with only Sales manager created and deleted a disposable customer. A user with only Sales rep saw seven assigned customers, updated a status, and had no create/edit/delete controls. A user with only Read-only user saw all twelve customers and no write controls, including in the detail drawer. Direct-request restrictions are covered by the server tests.
- English and Chinese list/detail screens and the 390 px mobile list in dark appearance were inspected. The table scrolls horizontally on narrow screens.

The full template test suite, automated browser suite, other browsers, other databases, production deployment and concurrent multi-process operation were not run. Dependencies emit missing-sourcemap warnings and the build reports a large client chunk; the default template also logs a React script-rendering warning before opening the customer feature. None blocked the verified flows. Screenshots use fictional demonstration data created in the running app; the source contains no demo accounts or database.

## 中文说明

这是「开发第一个功能」的客户管理示例，业务需求与文档保持一致。销售只能查看自己负责的客户并更新状态；修改备注、联系方式、负责人和跟进日期需要销售主管权限。

在本目录执行上面的安装、配置和启动命令。首次启动会创建客户表和三种角色，在用户管理中把角色分配给具体用户。源码不附带本地配置、数据库、演示账号或截图数据；可自行新建客户体验。页面文案支持中文与英文，切换应用语言即可。
