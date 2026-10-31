# Background tasks example

This is a headless NocoBase Application for the Background jobs and scheduled execution guide. Keep the command-only scope: no browser UI, HTTP listener, database, authentication service or commercial plugin is required. Local commands are trusted operator actions, not authenticated HTTP endpoints.

Keep jobs in `server/jobs/`, business file generation in `server/reports/`, lifecycle in `server/providers/`, and executable demonstrations in `scripts/`. Use the real Application, Jobs service and Provider lifecycle. Payloads must remain JSON data; bind application dependencies through the job-class factory. Do not replace executors with a custom queue or timers.

The memory backend requires one process per storage directory. Every demo creates an isolated directory under `storage/demos`; recovery deliberately reopens the same directory after shutdown. CSV output is a durable business result; the bounded in-memory event array is not task history. Keep file publication atomic and repeated report IDs harmless.

Run `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm format:check`, then execute affected demo commands. Keep versions pinned and record tested behavior in README.md. Never commit dependencies, generated output, runtime data or credentials.
