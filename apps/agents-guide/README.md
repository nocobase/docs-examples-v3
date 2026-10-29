# Agents guide example

A fresh Default-template application for the NocoBase 3 [Agents guide](https://docs.nocobase.com/core/using-plugins/agents-and-knowledge/agents/) ([中文](https://docs.nocobase.com/zh-CN/core/using-plugins/agents-and-knowledge/agents/)).

The application uses an English interface, SQLite, model API conversations, a `release-notes` business Skill, and optional machine Agents. Source belongs in `nocobase/docs-examples-v3/apps/agents-guide`. The documentation download keeps the existing filename `agents-doc-demo.zip`; its contents are this application. Clone the repository and enter `apps/agents-guide` to use this example. For the exact version used by an article, follow its pinned source link.

Template background and upgrade notes are retained in [TEMPLATE.md](TEMPLATE.md).

## Versions

Verified on 2026-10-29 with Node.js 24.21.0, pnpm 11.7.0, Default template 1.0.0-beta.84, Agents 1.0.0-beta.29, application CLI client 0.1.0-beta.17, and Runner 0.1.0-beta.20. Use the lockfile. The live model was DeepSeek `deepseek-flash`; discover the models available to your own account.

## Setup and run

Run from this directory. The example repository root is not a workspace.

```bash
pnpm install --frozen-lockfile
pnpm nocobase config init --dialect sqlite --json
pnpm nocobase config set i18n.defaultLocale=en-US server.host=0.0.0.0 server.port=13130 app.publicOrigin=http://YOUR_LAN_IP:13130 --json
pnpm nocobase config check --json
pnpm nocobase db apply --dry-run --json
pnpm nocobase db apply --json
APP_SERVER_PORT=13130 pnpm dev
```

Replace `YOUR_LAN_IP` with the address of the machine serving the application. Open `http://YOUR_LAN_IP:13130/main/`; retain `/main/`. `config init` creates private local configuration and credentials. Use that application's initial administrator account. Agents is already registered in all three plugin lists; do not scaffold or register it again.

In **Models → Add service**, configure your own provider and key. For the documented example, choose DeepSeek, use `https://api.deepseek.com/v1`, fetch models, enable a chat model, test the connection, and save. Reopening a service leaves its write-only key field empty. The key is entered privately and stored by the application; it is not in this source tree.

Open **Agent chat**, select the model, and send the writing prompt in the guide. Reopen it through **Conversations** to check saved history.

## Release-note Skill

Create the import archive from the included source:

```bash
python3 -m zipfile -c release-notes-skill.zip examples/release-notes
```

Use **Skills → Import** to import it. Check the `release-notes` slug, `SKILL.md`, and `references/style.md`. Leave Global attachment off; the native business scope selects this Skill explicitly.

Click the header file icon **Draft release notes**. It creates a new conversation selecting `release-notes` and the first enabled chat model. A second click after completion creates another conversation; use history to continue a draft. Send the guide's supplied facts. Test counts in a prompt are writing material, not evidence of tests run by the model. When configuration is missing the entry shows an error and allows retry.

## Optional Runner verification

Install and sign in to a supported coding tool on the target machine. Build the two distributions from this application:

```bash
pnpm nocobase cli build --universal
pnpm nocobase cli build --runner --universal
```

These need npm network access. They write ignored `storage/runners/dist/`; they do not build the production application. Universal packages use the target machine's Node.js 24. Restart the app after initial setup.

`package.json` declares `nocobase.cli.bin: agents-guide`. `server/config/agents.ts` is registered in `server/config/index.ts`, and selects that same CLI with `{ kind: 'served' }`. Without a distribution, the connection installer returns 404; without the application CLI, an online runtime can fail a run with `cliUnavailable`.

In **Runtimes → Add runtime**, choose Personal and the installed coding tool, then follow the generated registration instructions. Keep its one-time token private. In **Machine agents**, add and enable a combination from the live available-model list if no recommended agent appeared. In **Agent chat**, use **Switch to runner agents** and select it. First run the read-only workspace prompt from the guide. An ordinary Runner chat receives its own workspace; application source is not attached automatically. Project integration, trusted working-directory selection, and source-code modification are beyond this example's implemented flow.

## Chapter-to-code map

| Guide section | Source |
| --- | --- |
| Plugin registration | `client/plugins.ts`, `server/plugins.ts`, `cli/plugins.ts` |
| Five management pages and original settings | `client/routes.ts` |
| Account lifetime | `client/components/agents-provider.tsx` |
| Chat UI and layout | `client/extensions/nocobase-agent-chat/`, `client/layouts/app-layout.tsx` |
| Business entry | `client/components/release-notes-button.tsx`, `client/layouts/components/header-actions.tsx` |
| Business scope and Skill | `server/providers/agents.ts`, `examples/release-notes/` |
| Permission labels | `client/pages/settings/page-permission-titles.ts`, `client/locales/` |
| Runner CLI configuration | `package.json`, `server/config/agents.ts`, `server/config/index.ts` |

## Checks

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p tsconfig.server.json --noEmit
pnpm exec tsc -p tsconfig.node.json --noEmit
pnpm exec vitest run tests/client/client-routes.test.ts tests/client/app-locale-coverage.test.ts tests/client/page-permission-titles.test.ts tests/client/release-notes-button.test.tsx
```

Four test files, 23 tests passed. Client/server/tooling typechecks and scoped lint/format checks passed. Real DeepSeek connection, UI replies, reopened history, UI Skill import, and original persisted Skill/support-file tool results were verified. Anonymous model/Skill API requests returned 401. Runner read-only execution completed after correcting missing CLI setup; actual `pwd` and `ls -A1` output confirmed the conversation workspace was empty. The entry tests cover pending duplicate clicks, creation failure/retry, no chat model, denied permission, and identity teardown. These are deterministic integration fixtures; they do not call the external model.

Complete multi-account browser acceptance, the full role matrix, IME composition, business writes, attachment parsing, production application build/deployment, and source-project coding are not verified. A 390 px panel and dark page were inspected, not a full mobile/theme matrix. Use `pnpm check` for broader delivery checks.

Known compatibility issue: running `pnpm exec shadcn add @nocobase/agent-chat` downgraded Agents to 0.1.0-beta.14. This source already restores 1.0.0-beta.29. Do not reinstall the Registry block unless you intend to review its dependency changes. Generated Skills sync on install. A React script-tag diagnostic exists on the template login baseline; it is not a model-operation failure.

Private `config.yml`, storage, database, sessions, Runner registrations, dependency directories, and built distributions are excluded from source and the documentation archive.
