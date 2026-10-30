# ITAM Lite conventions

Read with [docs/design.md](../../docs/design.md) before changing devices, device requests, roles or notifications.

- **Request state changes only through the lifecycle.** `deviceRequests.status`, `statusChangedAt` and `lifecycleVersion` are written by `server/requests/lifecycle.ts` through the one runtime in `server/providers/requests.ts`. Routes create with `tx.create()` and move with `runtime.fire()`/`tx.fire()`; never write these fields from a route, a seed or SQL.
- **Every operation is its own permission.** `deviceRequests` actions are `read`, `create`, `approve` (also reject), `issue` and `withdraw`; `devices` actions are `read`, `create`, `edit` and `delete`. A route authorizes its action before validating input and finds the record through that action's policy. Lifecycle guards hold business rules (the requester cannot approve their own request), not permissions.
- **Notifications go through the notification plugin's `inbox` channel** (`notification.channels.inbox` in `config.yml`) as lifecycle effects, so a failed delivery is retried and visible under System settings → Workflow management → Executions. Recipients are the holders of the `asset-manager` and `it-support` permission sets, or the requester.
- **Approval rules are lifecycle parameters** (`approvalRules` in `server/requests/lifecycle.ts`), edited on the workflow definition page and read live at submission. Do not move them into code constants or `config.yml`.
- **Role keys are stable:** `employee`, `it-support`, `asset-manager` (`database/main/seeds/202610300202_itam_roles.ts`). Change their grants through Permission management or a new seed that preserves administrator changes; never edit an executed seed to change an installation.
