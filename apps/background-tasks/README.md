# Background tasks

A headless NocoBase application for [Background jobs and scheduled execution](https://docs.nocobase.com/core/developing-apps/background-tasks/). Generate an order-summary CSV through a real `JobExecutor`, submit work through a real `ScheduleExecutor`, and observe progress, retries and graceful recovery.

## Requirements and scope

Use Node.js 24 and pnpm 11.7.0. Published dependencies are App Server `3.0.0-beta.5`, Jobs `1.0.0-beta.5` and ServiceProvider `0.0.2-beta.2`, pinned by `pnpm-lock.yaml`. API behavior was checked against NocoBase `v3-develop` commit [`d04061ee252afbcc2f42cf1d69ab8888e72d604a`](https://github.com/nocobase/nocobase/tree/d04061ee252afbcc2f42cf1d69ab8888e72d604a). That source tree labels App Server `4.0.0-beta`; the runnable example uses the published version consumed by Default template `1.0.0-beta.85`.

This app composes the real `Application` and its Jobs provider directly; it is not a full Default template. It does not need a database, HTTP server, browser, Docker or commercial plugin. Commands run as the local operator. Adding an HTTP entry requires authentication, authorization and input validation at that entry; these commands are not an HTTP security example.

The three orders are fixed English demonstration data. The CSV files, memory executor state, retry behavior and schedule execution are real. `stepMs` simulates slow work; `failure: 'first'` and `'always'` deliberately throw before publishing a file. These controls demonstrate failures without requiring an external service. `reportId` identifies one immutable report; a different dataset or business period needs a different report ID.

Only one process may use a storage directory. The event array is a bounded process-local observation window, cleared on restart, not durable history. The output CSV is the business result. Atomic publication uses a temporary file and a same-directory hard link, so the filesystem must support hard links. A forced process exit can leave temporary files, lose newly queued jobs or replay previously completed work; the example does not implement crash-safe delivery, automatic temporary-file cleanup, or an Outbox.

## Install and run

From `apps/background-tasks`:

```sh
pnpm install --frozen-lockfile
pnpm demo manual
```

Every command prints its isolated `storage/demos/<scenario>-<suffix>` directory. Reports are written under that directory's `storage/reports/`, and job snapshots under `storage/jobs/`. Keep the printed directory to inspect the result. Nothing listens on a network port. Each command shuts down its App before exiting.

The manual demo prints an accepted job ID, progress at 30, 60, 90 and 100, a `JobEnd` event and this CSV:

```csv
orderId,customer,total
ORD-1001,Cedar Books,120
ORD-1002,Harbor Supply,75
ORD-1003,Maple Market,210
```

## Commands and coverage

| Documentation usage                               | Command or test      | Source                                                     | Observable result                                                                                   |
| ------------------------------------------------- | -------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Job class, JSON payload, business dependency      | `pnpm demo manual`   | `server/jobs/report-job.ts`, `server/reports/generate.ts`  | Complete CSV for three orders                                                                       |
| App composition, registration, setup and shutdown | Every demo           | `server/app.ts`, `server/providers/reports.ts`             | Work starts after setup; executors close before exit                                                |
| Submission receipt and local progress events      | `pnpm demo manual`   | `server/reports/service.ts`, `server/providers/reports.ts` | Receipt ID correlates with attempts and progress                                                    |
| Failure followed by retry                         | `pnpm demo retry`    | `server/config.ts`, `server/reports/generate.ts`           | Attempt 1 fails; attempt 2 completes                                                                |
| Failure budget exhausted                          | `pnpm demo failure`  | Same files                                                 | Three error attempts; no CSV; the command exits successfully after checking this expected failure   |
| Business idempotency                              | `pnpm demo repeat`   | `server/reports/generate.ts`                               | Two distinct job IDs, one unchanged CSV inode                                                       |
| Fixed interval                                    | `pnpm demo interval` | `server/reports/service.ts`                                | `every: 200`, `limit: 2`; two completed reports                                                     |
| Cron and explicit timezone                        | `pnpm demo cron`     | Same file                                                  | Accelerated one-second UTC cron, limited to two reports                                             |
| Daily cron, stable-name update, query and removal | `pnpm demo rules`    | Same file                                                  | Changes one rule to 02:00 Asia/Shanghai, prints its next run, removes it                            |
| Cooperative interruption and recovery             | `pnpm demo recovery` | Provider, generator, `scripts/demo.ts`                     | Shutdown after first progress, a new App opens the same storage, same job ID completes on attempt 2 |
| Producer-only setup                               | `pnpm test`          | `tests/reports.test.ts`                                    | Pending work survives producer shutdown and runs on the next consumer                               |
| Invalid inputs and conflicting schedule options   | `pnpm test`          | Same file                                                  | Invalid report IDs and simultaneous `every`/`cron` reject                                           |
| Memory backend and missing Redis implementation   | `pnpm test`          | Same file                                                  | Real memory execution; selecting an unregistered Redis backend throws                               |

The production-style cron in `rules` is inspected, not awaited until the next day. The accelerated `cron` command actually executes the handler. Recovery constructs a new App after a graceful shutdown in the same command; it does not simulate a killed process or a machine failure. Schedule success only means it submitted a report job; the demos wait for the report job's `JobEnd` before counting a completed report.

`server/config.ts` sets `attempts: 3` (first try included) and `concurrency: 1`. A normal handler error spends the failure budget; an interrupted ordinary job can restart without spending that budget. `context.attempt` counts starts, including recovery. Each attempt restarts progress; there is no checkpoint resume.

In an existing default-template app, use its existing Jobs provider, add `ReportsProvider` to `server/providers/index.ts`, and retain existing providers such as `SubmissionProvider`. Keep your configuration factories and configure the `reports` section that this provider reads. Do not replace the application composition with this minimal example.

## Verification

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

`pnpm build` compiles this command-only example with TypeScript, not into a NocoBase deployment archive. The seven tests run the real App, Providers, memory job and schedule executors with isolated temporary storage. They check CSV contents, repeat protection, progress, retry exhaustion, shutdown interruption, recovery, producer-only operation, cron/interval execution, rule preservation/update/removal and missing backend errors.

Validation environment: Linux, Node `24.21.0`, pnpm `11.7.0`, the published package versions above and the memory backend. Type checking, all seven tests, build, formatting and all eight demo commands passed. Redis, multi-process workers, forced-exit recovery, database transactions and HTTP authorization were not exercised.

## Optional Redis deployment

Jobs Redis belongs to the commercial `@nocobase/app-plugin-jobs-redis` plugin. Obtain authorized access and register its Server plugin on every producer and consumer before selecting `adapter: redis`. Jobs core only includes memory. A missing selected implementation raises `JobsBackendNotRegisteredError`; it does not fall back to memory. See the [Jobs source guide](https://github.com/nocobase/nocobase/blob/d04061ee252afbcc2f42cf1d69ab8888e72d604a/packages/libs/jobs/README.md) and the installed commercial plugin's instructions for compatible registration and connection configuration. Redis is optional and is not installed by this example.
