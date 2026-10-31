# Request validation and error handling

A headless order application for [Request validation and error handling](https://docs.nocobase.com/core/developing-apps/request-validation-and-errors/). It runs real authentication, authorization, Zod validation, Repository writes, standard API errors and OpenAPI generation. There is no browser UI.

## Requirements and scope

Use Node.js 24 and pnpm 11.7.0. Published dependencies are pinned in `package.json` and `pnpm-lock.yaml`: app-server `3.0.0-beta.4`, authentication `2.0.0-beta.15`, authorization plugin `1.0.0-beta.33`, db `1.0.0-beta.23`, api-client `1.0.0-beta.6` and Zod `4.6.5`. This application assembles the server runtime rather than using a complete Default template. Its API behavior was also compared with NocoBase development source at `d04061ee252afbcc2f42cf1d69ab8888e72d604a`; that source snapshot is not a published package version.

SQLite is the supplied local configuration. Validation and API errors do not require SQLite; other database adapters have not been tested in this example. No external service is required. Configuration, credentials, database files and logs remain under ignored local paths.

Alice Sales can list, create and edit orders. Robin Reader can list and read them. Explicit permission-set assignments apply only to these accounts, and their allowed operations cover all demo records. This example does not demonstrate row ownership or grant access to arbitrary signed-in users. Authentication and action authorization run before input validation and record lookup.

Orders contain a customer, a reference, one or more item names and quantities, an optional note, and a status. New orders are drafts. The fixture includes a confirmed order to demonstrate the edit restriction; no confirmation, stock, billing or delivery workflow is implemented. IDs for these business records are UUIDs; authentication user IDs have their own format. Reference text is not a unique key, and creating an order is not an idempotent operation.

## Install and prepare

Run from `apps/request-validation`:

```sh
pnpm install --frozen-lockfile
pnpm setup
pnpm start
```

Setup generates secrets and an administrator in `config.yml`, creates two ordinary accounts with their permission assignments, and inserts one customer and two orders. Credentials and record IDs are saved to `storage/demo.json`, with owner-only file permissions. Setup leaves an existing configuration and completed demo dataset unchanged. The HTTP listener binds to `0.0.0.0` on port 13220. For LAN access, set `APP_PUBLIC_ORIGIN` to the machine's reachable origin on both setup/start and request/demo commands; for local command-line use it defaults to `http://localhost:13220`.

In a second terminal, from the same directory:

```sh
pnpm demo
```

The script signs in, checks success and failure responses, verifies refused edits did not change the fixture, then creates a new order, updates its reference and clears its note. Each run creates one additional order. It finishes with `All HTTP scenarios passed; rejected edits left the fixture unchanged.` Malformed JSON is sent as raw text. The normal application has no deliberate crash endpoint; unexpected failures are injected only in isolated tests.

## Individual requests

The request helper signs in as Alice using the generated credentials and calls a path relative to `/main/api`. It prints the complete JSON response and exits with status 1 for HTTP failures. The second example below is expected to fail:

```sh
pnpm request GET 'orders?page=1&pageSize=1'
pnpm request GET 'orders?page=0'
pnpm request PATCH orders/22222222-2222-4222-8222-222222222222 '{"note":null}'
DEMO_ROLE=reader pnpm request PATCH orders/not-a-uuid '{"status":"confirmed"}'
```

Use `pnpm request GET swagger` to read the authenticated OpenAPI document. Its order operations include inputs, success schemas, generated validation errors and explicit business failures. In another application, obtain its own session or API key and use its actual API base path; the helper and fixture IDs belong only to this example.

The example endpoints are `GET /orders`, `GET /orders/:id`, `POST /orders` and `PATCH /orders/:id`, all below `/main/api`. A patch that omits `note` preserves it; `note: null` clears it. An empty patch and unknown JSON fields are rejected. Query and path schemas use `z.object`; body schemas use `z.strictObject`.

## Code and verification map

| Documentation usage                            | Entry or command                              | Source                                                    | Observable result and verification                                                                                                   |
| ---------------------------------------------- | --------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Route registration and validated values        | `pnpm request GET orders`                     | `server/routes/index.ts`, `server/routes/orders.ts`       | Authenticated request reaches the service with `c.req.valid()` values                                                                |
| Query conversion and defaults                  | `pnpm request GET 'orders?page=1&pageSize=1'` | `server/routes/schemas.ts`                                | Numeric pagination metadata; invalid bounds return 400                                                                               |
| Path, body, nested and object-level validation | `pnpm demo`; validation test                  | `server/routes/schemas.ts`                                | `INVALID_INPUT`, including `items.0.quantity` or an empty field path for a whole-object issue                                        |
| Omitted and nullable fields                    | `pnpm demo`; creation test                    | `server/orders/service.ts`                                | Omitted note is preserved; explicit null is persisted                                                                                |
| Malformed JSON                                 | `pnpm demo`; malformed JSON test              | `scripts/demo.ts`                                         | 400 `HTTP_400` at the pinned versions, before schema validation                                                                      |
| Missing resources and business-state failures  | `pnpm demo`                                   | `server/orders/service.ts`, `server/routes/errors.ts`     | 404 `ORDER_NOT_FOUND`; 400 `CUSTOMER_UNAVAILABLE` or `ORDER_LOCKED`; stored data unchanged                                           |
| Repository error propagation                   | `pnpm test -t 'Repository errors'`            | `tests/orders.test.ts`                                    | Real Repository policy refusal is 403 `WRITE_FORBIDDEN`; a bare Hono router renders a missing-write target as 404 `RECORD_NOT_FOUND` |
| Unknown exceptions and request IDs             | `pnpm test -t 'unexpected failures'`          | `tests/orders.test.ts`                                    | A test-only injected failure becomes opaque 500; request ID is echoed in body and header                                             |
| Response declarations                          | `pnpm request GET swagger`; OpenAPI test      | `server/routes/orders.ts`, `server/routes/schemas.ts`     | Generated 400 for validators; explicit business descriptions; public fields selected in the service                                  |
| Client error access                            | `pnpm demo`; API Client test                  | `scripts/client-errors.ts`                                | Numeric HTTP status, domain, reason, request ID and safely parsed `payload.error.fieldViolations`                                    |
| Permission order and failed writes             | `pnpm test`                                   | `server/orders/permissions.ts`, `server/routes/orders.ts` | Reader receives 403 even for malformed input or missing records; database snapshots remain unchanged                                 |

## Checks

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Tests start a fresh application and SQLite database for each test using `createAppTest({ scope: 'test' })`; they do not use the walkthrough database. Authentication, permissions and Repository calls are real. One isolated test replaces a downstream write policy to exercise Repository error propagation. Another replaces the update method with a thrown exception to verify the application-level 500 fallback. Neither test hook is present in the runnable server.

`pnpm build` compiles TypeScript; it does not create a NocoBase deployment archive. HTTP failures do not themselves roll back earlier committed work. This service validates and checks business rules before writing, and uses database transactions for writes. The tests check refused requests, not arbitrary distributed failures or external side effects. Concurrent order confirmation is outside the example's verified scope.

Validation record: Node.js 24.21.0 and pnpm 11.7.0 on Linux, using the pinned published dependencies and SQLite. Type checking, all eight integration tests, TypeScript build and formatting passed. Fresh setup, the HTTP walkthrough and the individual request helper were also exercised through a LAN origin. The runtime-generated OpenAPI document was checked by the integration suite. Other database adapters, concurrent confirmation and external side effects were not verified.
