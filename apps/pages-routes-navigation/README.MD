# Pages, routes and navigation

A runnable companion to [Pages, routes and navigation](https://docs.nocobase.com/core/developing-apps/pages-routes-and-navigation/) ([中文](https://docs.nocobase.com/zh-CN/core/developing-apps/pages-routes-and-navigation/)).

The home page links to the demonstrations. Project and task data is public fiction, kept in `client/pages/projects/data.ts`. Draft forms preview input without saving projects. Authentication, users, permission sets and page authorization use the actual application services and database.

## Versions and setup

- Node.js 24; pnpm 11.7.0 (the `packageManager` field).
- Default application template `1.0.0-beta.85`.
- `@nocobase/app-client` `4.0.0-beta.5`; other exact resolutions are in `pnpm-lock.yaml`.
- SQLite is this example's demonstration and verification database. It needs no database server and is not a requirement of routing. Other database configurations were not verified for this example.

From this directory:

```bash
pnpm install --frozen-lockfile
pnpm nocobase config init --dialect sqlite
pnpm nocobase config check
pnpm dev
```

Open the entry printed by the dev command, including `/main/`. The initial administrator is defined in your generated `config.yml`, under `users.initialAdmin`. The configuration example starts in English; the app also includes Chinese translations. A saved browser language choice takes precedence.

For access from another device, determine this machine's current LAN address and start with the intended public origin. For example, in a POSIX shell, replace `YOUR_LAN_IP` before running:

```bash
APP_SERVER_HOST=0.0.0.0 APP_SERVER_PORT=13581 \
APP_PUBLIC_ORIGIN=http://YOUR_LAN_IP:13581 pnpm dev
```

Verify `http://YOUR_LAN_IP:13581/main/` from that device. The origin contains no `/main` prefix. Use the same host when signing in and taking screenshots. Local configuration, SQLite data, credentials, sessions, dependencies and build output are ignored by Git. No ZIP or other separately maintained example archive is needed.

## Demo map

Paths below omit `/main`. Source paths are relative to this application. Screenshots are committed with the documentation in `website-v3/doc/public/assets/core/developing-apps/pages-routes-and-navigation/`, shared by both languages. The capture script writes PNG files; it does not generate illustrations or mock interfaces.

| Documented usage                                     | Entry or action                                                       | Source                                                             | Expected result and verification                                       | Screenshot                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------- |
| Registration and default component export            | Home → Project list                                                   | `client/routes.ts`, `client/pages/projects/routes.ts`, `index.tsx` | List and menu render; registration and browser checks                  | `home`, `projects`                                |
| Parameters and query state                           | Search Harbor, open Harbor launch                                     | `client/pages/projects/index.tsx`, `detail.tsx`                    | `q=Harbor` follows the link; project parameter resolves fixture        | `filtered`                                        |
| Child route drawer                                   | `/projects/p100?q=Harbor`                                             | `client/pages/projects/detail.tsx`                                 | Direct load works; close returns to filtered list                      | `drawer`                                          |
| Missing record                                       | `/projects/missing`                                                   | `client/pages/projects/detail.tsx`                                 | Explicit missing-record result                                         | `missing`                                         |
| Nested task dialog                                   | Drawer → Prepare launch checklist                                     | `client/pages/projects/task.tsx`                                   | Both IDs resolve; close returns to drawer, then list                   | `task`                                            |
| Full child page, static/dynamic breadcrumb           | Drawer → Open workspace                                               | `client/pages/projects/workspace.tsx`                              | `RouteChildPage` covers parent; project breadcrumb returns with query  | `workspace`                                       |
| Independent route and named export                   | Drawer → Open as a full page                                          | `client/pages/projects/routes.ts`, `workspace.tsx`                 | Same content at `/project-pages/p100`, outside list outlet             | `standalone`                                      |
| Static child, form and programmatic close            | New draft → Preview draft → Finish preview                            | `client/pages/projects/new.tsx`                                    | Preview is local; returns to parent, preserving query                  | `draft`, `draft-preview`                          |
| Asynchronous close/navigation guard                  | Edit draft, then Close or browser Back                                | `client/pages/projects/new.tsx`                                    | Keep editing preserves input; discard permits departure                | `guard`                                           |
| Default child and embedded tabs                      | `/reports`, then Owners                                               | `client/pages/reports/`                                            | Parent redirects once; direct Owners is retained                       | `summary`, `owners`                               |
| Pathless/prefixed groups, ordering and active menu   | Sidebar Projects and Insights                                         | `client/pages/projects/routes.ts`                                  | Groups organize entries; project child selects list                    | `navigation`                                      |
| Required authentication                              | Open `/projects` signed out                                           | `client/routes.ts`, `client/routing/`                              | Redirects to login                                                     | `login`                                           |
| Guest authentication and redirect                    | `/welcome` signed out; signed in with `?redirect=%2Freports%2Fowners` | `client/pages/examples/welcome.tsx`, template auth layout          | Guest sees welcome; authenticated user goes to Owners                  | `guest`                                           |
| Optional authentication                              | `/public-projects`                                                    | `client/pages/examples/public.tsx`                                 | Available signed out, standalone layout                                | `public`                                          |
| Page grants and inherited permissions                | Sign in as Project Viewer, open list/details                          | `client/pages/projects/routes.ts`, settings title map              | Project grant allows inherited children; draft button hidden           | `viewer`                                          |
| Extra child grant                                    | Project Viewer → `/projects/new`                                      | `client/pages/projects/routes.ts`                                  | Parent access alone does not grant draft access                        | `draft-denied`                                    |
| `skip` beneath a guarded parent                      | Project Viewer → `/admin-notes/child`                                 | `client/pages/examples/admin.tsx`, route declarations              | Parent still denies child                                              | `admin-denied`                                    |
| `unrestricted` and `skip`                            | Administrator → `/admin-notes/child`; viewer → reports                | Same as above; reports routes                                      | Unrestricted account enters admin; viewer can read reports             | `admin`, `owners`                                 |
| Same-package forward attachment                      | Insights → Export instructions                                        | `client/pages/projects/routes.ts`, `client/routes.ts`              | Contribution attaches to a later-declared group                        | `exports`                                         |
| Cross-package attachment                             | Temporarily clear overrides, open snapshot                            | `client/reporting-plugin.ts`                                       | Plugin component and namespace under application group                 | `plugin-original`                                 |
| Conditional plugin contribution                      | Disable contribution and clear overrides                              | `client/plugins.ts`, `client/reporting-plugin.ts`                  | Snapshot menu disappears                                               | `plugin-disabled`                                 |
| Component override and explicit runtime registration | Default Insights → Reporting snapshot                                 | `client/route-overrides.ts`, `client/runtime.ts`                   | Custom component keeps URL, menu, owner and permissions                | `plugin-custom`                                   |
| Lazy loading                                         | Home → Try a slow page                                                | `client/pages/projects/routes.ts`                                  | Standard loading state, then content                                   | `loading`, `loaded`                               |
| Component failure                                    | Home → Try a page error                                               | `client/pages/examples/broken.tsx`                                 | Deliberate exception produces template error interface                 | `error`                                           |
| Unknown address                                      | Home → Try an unknown address                                         | `client/routing/app-router.tsx`                                    | Template redirects to home                                             | `unknown`                                         |
| Invalid definitions                                  | Run routing-contract tests                                            | `tests/client/routing-contract.test.ts`                            | Invalid paths, mounts and authorization declarations fail in isolation | No UI route; assertions are the observable result |

The local `@example/project-reporting` factory demonstrates plugin contracts without publishing an npm package. It is not an installation instruction. The app explicitly passes `routeComponentOverrides` to `defineAppRuntime`; a file named `route-overrides.ts` alone is insufficient.

## Permission demonstration

Using the administrator, open **System settings → Permission management → Roles and permissions**. Create a role named **Project viewer** and grant only **Project list → Access** under page permissions. Do not grant **New draft** or system settings. In **System settings → Users**, create a demonstration account and assign that role, without other roles that add access.

Sign in using a separate browser session. Open the list, then the detail and task. Visit `/projects/new` and `/admin-notes/child` directly: both must deny access. Visit `/reports/owners`: it remains available because that page uses `skip`. These grants control pages, not server business operations. The bundled project fixtures intentionally contain no private data.

For repeatable documentation capture, the helper below creates a new demonstration-owned permission set and user through authenticated APIs. It never edits existing grants. Each run creates another user and role; remove them in system settings when no longer needed.

```bash
# Supply a dedicated demonstration administrator through the shell environment.
# APP_URL includes /main/; E2E_USERNAME and E2E_PASSWORD are not committed.
node scripts/prepare-routing-viewer.mjs
```

The helper writes the generated viewer credentials to ignored `storage/documentation/viewer.json` (mode 0600). `CAPTURE_MODE=limited` reads that file. Manual permission setup and this API helper reach the same real application authorization services.

## Reproduce screenshots

Install Chromium once if needed:

```bash
pnpm exec playwright install chromium
```

Set `APP_URL`, `E2E_USERNAME` and `E2E_PASSWORD` for the dedicated demonstration instance. Set `SCREENSHOT_DIR` if the output should go somewhere other than `storage/documentation/screenshots`.

```bash
CAPTURE_MODE=public node scripts/capture-routing.mjs
CAPTURE_MODE=admin node scripts/capture-routing.mjs
node scripts/prepare-routing-viewer.mjs
CAPTURE_MODE=limited node scripts/capture-routing.mjs
```

Public capture needs only `APP_URL`. Administrator capture signs in through the normal login form and verifies a real session response. Captures also assert navigation results and reject unexpected browser page errors. The deliberate broken-page error is allowed only for its demonstration. No browser session is saved to disk.

To capture the alternative plugin configurations, first change the exported array in `client/route-overrides.ts` to `[]`:

```bash
CAPTURE_MODE=original node scripts/capture-routing.mjs
```

Then change `reportingPlugin({ enabled: true })` to `false` in `client/plugins.ts`:

```bash
CAPTURE_MODE=disabled node scripts/capture-routing.mjs
```

Restore `enabled: true` and the original override declaration afterward. Do not run the default registration tests while those temporary variants are active: they intentionally expect the shipped configuration.

Screenshots use English at 1280 × 800. The script also checks the nested dialog at 375 pixels and its return path. A screenshot cannot prove behavior by itself; the assertions and tests check the relevant transitions. `capture-<mode>.json` files record the capture environment locally and are not site assets.

## Checks and verification

```bash
pnpm typecheck
pnpm lint
pnpm exec vitest run tests/client/client-routes.test.ts tests/client/routing-contract.test.ts tests/client/routing-behavior.test.tsx tests/client/app-locale-coverage.test.ts tests/client/page-permission-titles.test.ts tests/client/home.test.tsx tests/client/client-shell.test.tsx tests/client/permission-management-routes.test.ts tests/client/foundation-integration.test.ts
pnpm build
```

The focused suite covers runtime registration and all loaders; path, duplicate and parent validation; plugin options and overrides; nested overlay close; query preservation; direct tab visits; denied grants; draft preview and asynchronous confirmation. Client tests use real application providers with controlled authorization responses. The screenshot run additionally uses actual SQLite accounts and grants.

Verified on Linux with Node 24, pnpm 11.7.0, SQLite and Chromium: installation, configuration, type checking, lint, the focused suite, application build, and all five capture modes. Administrator and viewer behavior was checked against the running server. Other databases and browsers were not exercised. Native browser reload confirmation is implemented with `beforeunload`; the capture script does not assert the browser-controlled prompt text.
