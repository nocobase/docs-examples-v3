# Order services

A headless NocoBase application for [Server business services](https://docs.nocobase.com/core/developing-apps/server-business-services/). Confirm an order through HTTP, an application command, or a background job. All three call the same service with real authorization policies and persist through the Repository API.

## Requirements and scope

Use Node.js 24 and pnpm 11.7.0. Dependencies are published npm packages pinned by `pnpm-lock.yaml`: app-server `3.0.0-beta.4`, db `1.0.0-beta.23`, service-provider `0.0.2-beta.2`, authentication `2.0.0-beta.15`, authorization plugin `1.0.0-beta.33`, and jobs `0.1.0-beta.4`. The example is assembled from the server runtime, not a complete Default template or a browser application.

SQLite and the memory job adapter are the tested local configuration. Neither is a requirement of business services. Other database adapters require their corresponding packages and configuration and have not been tested here. Use one application process with this memory adapter: stop the HTTP server before running a command that starts another application. Graceful shutdown writes pending jobs; this is not a demonstration of durable multi-process delivery.

Authentication, permission-set assignments, row scopes, transactions and job execution are real. Alice and Bob can read and confirm their own orders; Robin can only read their own orders. Direct user assignments are created for these named accounts only. The application does not resolve team memberships for local commands or jobs. The submission route derives the job actor from the authenticated session; the worker checks account availability and authorization again when executing.

Each order contains one product and a positive quantity. Confirmation changes `draft` to `confirmed` and deducts stock atomically. Reconfirming a confirmed order does not deduct again. Conditional writes prevent silent overwrite of the order state and stock balance; a concurrent conflict may require rereading the order. This is business-level repeat protection, not a general HTTP idempotency-receipt implementation. A post-commit callback writes an application log, not an email. Callback failure does not undo the order and is not retried by this example.

## Install and prepare

Run from `apps/order-services`:

```sh
pnpm install --frozen-lockfile
pnpm setup
```

Setup creates `config.yml` with generated secrets and an initial administrator, then starts the application without a network listener, creates three ordinary users, assigns their permission sets, and inserts demo orders. It writes credentials and record IDs to `storage/demo.json`. Both files are ignored by Git. Setup leaves an existing configuration and an existing demo dataset unchanged; it does not reset data or revoke later changes to roles.

The fixture contains a product with stock 10, three orders (`http`, `cli`, `job`) for two units each, an insufficient-stock order for 99 units, Bob's order, and Robin's order. Different runs generate different IDs. Test fixtures use isolated temporary databases and do not alter this dataset.

## HTTP and background execution

```sh
pnpm start
```

In a second terminal, from the same directory:

```sh
pnpm demo
```

The default origin is `http://localhost:13210`. To use a LAN host or another origin, set the same `APP_PUBLIC_ORIGIN` on both commands. The server binds to `0.0.0.0`; use an actual reachable host in the origin. The script signs in through the real authentication endpoint, keeps cookies in memory, and sends requests to `/main/api`.

The script prints these results:

| Operation                      | Expected response                            |
| ------------------------------ | -------------------------------------------- |
| Confirm Alice's HTTP order     | `200`, `data.status: "confirmed"`            |
| Confirm it again               | `200`, no second stock deduction             |
| Confirm the 99-unit order      | `409`, `OUT_OF_STOCK`; order stays draft     |
| Confirm Bob's order as Alice   | `404`, `ORDER_UNAVAILABLE`                   |
| Confirm Robin's order as Robin | `403`, `ORDER_ACTION_DENIED`                 |
| Enqueue Alice's job order      | `202`, `data.jobId`                          |
| Poll that order                | Eventually `200`, `data.status: "confirmed"` |

HTTP endpoints are `GET /main/api/orders/:id`, `POST /main/api/orders/:id/confirm`, and `POST /main/api/orders/:id/confirmAsync`. The asynchronous receipt reports acceptance, not completion. The protected OpenAPI document is at `/main/api/swagger`. There is no browser UI. The script may be repeated: already confirmed orders do not deduct stock or repeat the post-commit log.

## Application command

Stop the HTTP server first, then use IDs from `storage/demo.json`:

```sh
pnpm confirm \
  "$(node -p 'JSON.parse(require("fs").readFileSync("storage/demo.json")).buyer.id')" \
  "$(node -p 'JSON.parse(require("fs").readFileSync("storage/demo.json")).orders.cli')" \
  --json
```

This is `pnpm nocobase app orders confirm <actorId> <orderId> --json`. Expect `ok: true`, `status: "success"`, and `result.status: "confirmed"`. Replacing the actor with `reader.id` and the order with `orders.reader` fails with a nonzero exit status. A local operator selects the actor explicitly; this command is not a remote identity assertion mechanism.

The command uses `AppCommand.withApp()` and explicitly awaits `app.start()` because authorization registration needs `boot()`. The CLI shuts down the application and its runtime even if confirmation throws. Starting the application also starts the sample worker. It does not open the HTTP listener.

## Code and verification map

| Documentation usage                                      | Entry or command                | Source                                                   | Observable result and verification                                                                                   |
| -------------------------------------------------------- | ------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Service contract, dependency injection and domain errors | HTTP confirmation               | `server/orders/service.ts`                               | Order view or domain error; service has no HTTP context                                                              |
| Shared token and lazy singleton                          | Any business entry              | `server/providers/orders.ts`                             | Routes, command and worker resolve the same application service                                                      |
| Provider composition                                     | Application startup             | `server/runtime.ts`, `server/providers/index.ts`         | Service and worker available after startup                                                                           |
| Authentication and HTTP error mapping                    | `pnpm demo`                     | `server/routes/orders.ts`                                | Real session checks and 200/202/403/404/409 responses                                                                |
| Data policies and request isolation                      | `pnpm test`                     | `server/orders/permissions.ts`, `scripts/fixtures.ts`    | Buyer sees only owned rows; reader cannot confirm                                                                    |
| Application command                                      | `pnpm confirm … --json`         | `cli/commands/orders/confirm.ts`, `cli/confirm.ts`       | Same persisted result with CLI-owned cleanup                                                                         |
| JSON job payload and execution-time authorization        | `pnpm demo`; job tests          | `server/orders/job.ts`, `server/providers/order-jobs.ts` | Real executor confirms; direct handler tests reject revoked/disabled actors                                          |
| Transaction rollback and conditional updates             | `pnpm test`                     | `server/orders/service.ts`                               | Insufficient stock or excluded product rolls back order state; overlapping confirmations deduct once                 |
| Post-commit operation and failure                        | `pnpm test -t post-commit`      | `tests/orders.test.ts`                                   | Simulated callback failure leaves committed result and emits a warning; repeated confirmation does not call it again |
| Worker lifecycle                                         | HTTP stop or command completion | `server/providers/order-jobs.ts`                         | Owned executor is shut down                                                                                          |

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

`pnpm build` compiles this server-only example with TypeScript; it does not create a NocoBase deployment archive. The service tests use the actual application, authentication plugin, authorization plugin and an isolated SQLite database. The post-commit failure is explicitly injected through the service's callback dependency; no external messaging service is used.

Validation record: Node 24 on Linux, published dependencies above, SQLite, memory jobs. Type checking, seven integration tests, TypeScript build, formatting, first-run setup, the real CLI and HTTP/background walkthrough were checked for this example. Other database engines, Redis workers and external delivery have not been verified.
