# Order services example

This is an intentionally headless application for the Server business services documentation. Keep business code under `server/orders/`, registration under `server/providers/`, HTTP adapters under `server/routes/`, and commands under `cli/commands/`. Do not add browser pages, workflow administration or a full application template unless requested.

Use the installed NocoBase public APIs. The framework owns authentication, authorization, database transactions, job reconstruction and CLI cleanup. Do not replace those mechanisms with mocks in the runnable application. Read `README.md` for the supported versions and verification map. Test changes with `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm format:check`; verify changed entry points through their documented commands. Never commit configuration, secrets, credentials, runtime data, node_modules or dist.

The demo creates explicit roles for named users. HTTP job payloads get their actor from the authenticated context, and execution rechecks that actor and the action. Services receive request policies as method arguments; never store them in singleton fields. CLI actor selection is a local operator capability, not an HTTP authentication method.
