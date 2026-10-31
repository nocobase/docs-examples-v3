# Database basics

Runnable companion to [Create tables and initialize data](https://docs.nocobase.com/core/developing-apps/data-models-and-migrations/) ([中文](https://docs.nocobase.com/zh-CN/core/developing-apps/data-models-and-migrations/)).

Create an `appStatuses` dictionary, install required default records, and add a nullable description in a later migration. This independent application uses the default NocoBase template `1.0.0-beta.84`. Its business example runs through database commands and isolated tests; it does not need a business management page.

## Requirements

Node.js 24 and pnpm 11.7.0. The committed lockfile pins published packages, including `@nocobase/db` 1.0.0-beta.23 and `@nocobase/app-testing` 0.1.0-beta.6. SQLite is the tested self-contained setup. Other databases require their driver and connection configuration; they have not been verified here.

## Install and test

Run from `apps/database-basics`:

```bash
pnpm install --frozen-lockfile
pnpm exec vitest run --project node tests/database/app-statuses.test.ts
```

The tests provision disposable databases. They do not need or reset your application's configured database.

## Apply to a development database

```bash
pnpm nocobase config init --dialect sqlite
pnpm nocobase config check
pnpm nocobase db apply --connection main --dry-run
pnpm nocobase db apply --connection main
pnpm nocobase collections generate --connection main --check
```

Configure your own database and initial administrator before startup. `config.yml`, secrets, generated Collection caches and storage are ignored by Git. Do not reinitialize an existing configured application.

The plan contains registered platform plugins as well as this application's files. Applying it creates `appStatuses` with `code`, `title` and nullable `description`. Required defaults are `draft` / `Draft` and `published` / `Published`; descriptions initially equal `null`. Repeating `db apply` skips successful history. Existing edited titles are preserved.

To start the template shell, run `pnpm dev` and use the complete application URL printed by the command. Users and permission administration are registered. This dictionary does not expose a public CRUD API or grant business permissions.

## Usage map

| Documentation usage                  | Execution entry                                              | Source                                                                | Expected result                                                                                               |
| ------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Create a table                       | `db apply`; base migration test                              | `database/main/migrations/202611040001_create_app_statuses.ts`        | Required code/title fields; duplicate codes rejected                                                          |
| Install defaults                     | `db apply`; initialization tests                             | `database/main/seeds/202611040002_default_app_statuses.ts`            | Two default records; edited titles preserved                                                                  |
| Upgrade existing data                | Upgrade test; later `db apply`                               | `database/main/migrations/202611040003_add_app_status_description.ts` | Old records retained with a nullable description                                                              |
| Roll back and reapply                | `describeMigration` in `tests/database/app-statuses.test.ts` | The two migrations and their `down` functions                         | Description removal retains records; base migration removal drops the dictionary                              |
| Distinguish history from idempotency | Seed tests                                                   | `tests/fixtures/app-statuses/seeds/`                                  | Repeated application skips history; deliberate reexecution with a separate test history creates no duplicates |
| Fail and retry                       | Seed failure test                                            | `tests/fixtures/app-statuses/failing-seeds/`                          | A post-write failure rolls back records and success history; retry succeeds                                   |

Fixtures import the actual Seed. The failure fixture adds a controlled throw after it runs. Neither fixture is loaded by normal application startup.

## Verify changes

```bash
pnpm exec vitest run --project node tests/database/app-statuses.test.ts tests/server/authorization-assignment-safety.test.ts
pnpm exec vitest run --project client tests/client/client-routes.test.ts tests/client/page-permission-titles.test.ts
pnpm exec tsc -p tsconfig.server.json --noEmit
pnpm build
```

Run scoped ESLint on the migrations, Seed, fixtures, tests and modified route registration. Keep existing migrations immutable after release; add a new file for later changes.

## Validation scope

Validated on Linux x64 with Node.js 24, pnpm 11.7.0 and SQLite: frozen-lockfile installation, five database behavior tests, two assignment-safety tests, server type checking and scoped ESLint. Configuration initialization/check, a dry run, real application of migrations and Seeds, repeated application with no pending work, and Collection cache consistency were also checked. Twelve client route/title checks and the production build also passed. Other database dialects and browser UI flows were not exercised for this example.
