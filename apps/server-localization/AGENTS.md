# Server localization example

Keep this example focused on server-generated report notifications. It composes a real NocoBase Application, I18nProvider and SessionProvider, and dispatches standard Request objects through Application.fetch without opening a network listener. Background commands resolve a registered service without any HTTP context. Do not add a browser UI, database, report generator or mail transport.

Use real locale files and middleware in tests, including a real session cookie for precedence. The embedded report-delivery plugin is a locale-only fixture, not a published package. Keep it registered through the application's plugin contribution mechanism. Demonstration preferences live only in memory; no authentication or private report data is involved.

Run pnpm typecheck, pnpm test, pnpm build, pnpm format:check and every documented demo. Record versions, output expectations and verification limits in README.md. Never commit generated output, dependencies, cookies or local runtime data.
