# Localization example

A runnable companion to [Localization](https://docs.nocobase.com/core/developing-apps/localization/) and [多语言](https://docs.nocobase.com/zh-CN/core/developing-apps/localization/). A product catalog demonstrates application resources, interpolation, plurals, formatting, saved language choices, partial Japanese resources, fallback and plugin overrides.

## Requirements and scope

Use Node.js 24 or newer and pnpm 11. This application was generated from `@nocobase/app-template-default` `1.0.0-beta.85`. The committed lockfile resolves `@nocobase/i18n` `2.0.0-beta.1`, `@nocobase/app-plugin-i18n` `1.0.0-beta.18` and `@nocobase/app-client` `4.0.0-beta.5`.

The catalog is public and contains fictional fixed data. Product edits live in page memory and reset on reload; filtering is local state. There are no product endpoints, database writes, currency conversions, notifications or authorization demonstrations. The language control uses the actual NocoBase plugin, browser preference storage and server session endpoints. Japanese is deliberately partial: the product page is translated, but `catalog.shipping` and untranslated template or plugin text fall back. This is not a complete Japanese product translation.

## Setup and run

Run these commands from `apps/localization` in a checkout of this source commit:

```bash
pnpm install --frozen-lockfile
pnpm nocobase config init --dialect sqlite
pnpm nocobase config check
pnpm dev
```

SQLite is the tested local setup choice, not a requirement of localization. Use an existing supported database configuration if appropriate. No external service is needed. Configuration and local application storage are gitignored.

Open the `Local:` address printed by the development server and append `localization` after the application base path. With `/main/` as the base, the page is `/main/localization`. No sign-in is needed. Administration remains behind the template's original authentication and authorization checks.

For LAN access, find the machine's LAN IP and set the actual browser origin before starting. Choose an available port and replace the placeholders:

```bash
pnpm nocobase config set app.publicOrigin=http://<LAN-IP>:<port>
APP_SERVER_PORT=<port> pnpm dev
```

The development server binds to `0.0.0.0`; confirm the actual printed port if the requested one is occupied. Use the LAN address with that port and the full application path. Do not commit a machine-specific address to this project.

## Documentation usage map

Screenshot names below refer to the shared English captures in the website repository's `doc/public/assets/core/localization/`. Browser tests can generate them with `SCREENSHOT_DIR`; screenshots and build output are not part of this source application.

| Documentation usage                       | Operation                                                                                       | Source                                                                                           | Capture or output                                            | Expected result and check                                                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Resource groups and navigation            | Open `/localization`; use the Product catalog link                                              | `client/locales/en-US.ts`, `zh-CN.ts`, `client/routes.ts`, `client/pages/localization/index.tsx` | `catalog.png`                                                | Navigation and heading use application keys; template and extension resources remain intact                                 |
| Interpolation                             | Open Arc desk lamp, rename and save                                                             | `client/pages/localization/edit.tsx`                                                             | `saved.png`                                                  | Confirmation includes the entered name; the list changes until reload                                                       |
| Field and failure messages                | Save an empty name; then enter a name, enable Simulate save failure, save, disable it and retry | `client/pages/localization/edit.tsx`                                                             | `validation.png`, `failure.png`                              | Translated error, retained input and successful retry; no backend mutation                                                  |
| Plurals                                   | Search for Arc, then an unknown name, then clear                                                | `client/pages/localization/index.tsx`, locale `catalog.count_*`                                  | `singular.png`, `empty.png`                                  | Counts 1, 0 and 3; English uses singular only for 1                                                                         |
| Number, currency and date formatting      | Switch language with the first product visible                                                  | `client/pages/localization/format.ts`, `index.tsx`                                               | `catalog.png`                                                | Formatting follows language; price remains USD and timestamps remain UTC                                                    |
| Saved language and server synchronization | Language menu → Language submenu → 中文 or 日本語; reload                                       | `client/layouts/components/language-switcher.tsx`, `client/pages/localization/index.tsx`         | `languages.png`; browser assertions on the real PUT response | Page updates without reload; saved choice survives reload; server accepts the same locale                                   |
| Add a language                            | Select 日本語                                                                                   | `client/locales/ja-JP.ts`, both `locales/index.ts`, `server/locales/ja-JP.ts`                    | Language-menu capture; Japanese browser assertions           | Japanese title and feature text; front/backend lists include Japanese                                                       |
| Defaults and fallback                     | Change default as below; open a fresh context, then select Japanese                             | `tests/client/localization.test.tsx`, `tests/playwright/localization.test.ts`                    | Test output                                                  | Japanese shipping note follows configured default; English is the next fallback; unknown keys fail strict tests             |
| Plugin overrides                          | Read Plugin wording and switch language                                                         | Application locale `overrides`, `index.tsx`                                                      | `catalog.png`; translated browser assertions                 | Real i18n plugin `language.label` reads Store language / 商店语言 / ストアの言語; selector's application key is independent |

The public page is outside `AppLayout`, so it calls `useSyncServerLocale()` itself and places the existing `LanguageSwitcher` inside a dropdown. The normal authenticated shell remains unchanged. Client-only language and transport-error behavior are supplied by the plugin; the example normally keeps the two language lists aligned.

## Checks

From the application directory:

```bash
pnpm nocobase locales check
pnpm typecheck
pnpm exec vitest run tests/client/localization.test.tsx tests/client/client-routes.test.ts tests/client/page-permission-titles.test.ts tests/client/app-locale-coverage.test.ts tests/project/agents-md.test.ts
pnpm build
```

Start the application before browser tests. `APP_URL` must be the actual application entry including its base path, not Vite's own port:

```bash
pnpm exec playwright install chromium
APP_URL=http://<host>:<port>/main/ pnpm exec playwright test tests/playwright/localization.test.ts
```

Without `APP_URL`, browser tests are skipped. To save screenshots, additionally set `SCREENSHOT_DIR` to an absolute directory. The browser suite uses a Chinese browser locale to verify that the application starts in its configured default rather than the browser's language.

To verify a Chinese default, change the configuration, wait for the development server to restart, run the defaults test, then restore English:

```bash
pnpm nocobase config set i18n.defaultLocale=zh-CN
APP_URL=http://<host>:<port>/main/ EXPECTED_DEFAULT=zh-CN pnpm exec playwright test tests/playwright/localization.test.ts --grep defaults
pnpm nocobase config set i18n.defaultLocale=en-US
```

Unset `APP_DEFAULT_LOCALE` if it overrides this configuration. The test first starts with empty browser storage, selects Japanese through the real menu, reloads and checks both the saved choice and the Chinese fallback note. The client test separately verifies that an explicit saved choice survives a change of configured default. A dedicated namespace fixture checks English as the final language fallback; application translations and the page render use real resources, without mocking `t()`.

## Verification record

Verified on Linux x64 with Node.js `24.21.0` and pnpm `11.7.0`, using the versions in this commit's lockfile and a fresh local SQLite configuration:

- Dependency installation, configuration initialization/check and `locales check` passed.
- Client, tooling and server type checks and the complete application build passed.
- Targeted ESLint and formatting passed for the feature and tests.
- The five targeted Vitest files passed (26 tests).
- Four Chromium scenarios passed across targeted runs: defaults and persistence, product interactions, live translation/formatting/overrides, and mobile/direct-entry/dark rendering. The defaults scenario also passed with Chinese configured as the default. Shared screenshots use the English interface.

Browser verification used the real running application through its LAN address. It covered actual server locale responses, saving and retrying the in-memory product, singular/plural/empty states, real language loads and refresh behavior. SQLite is the only database exercised; production deployment, translated outgoing mail, complete Japanese coverage and business authorization are outside this example's scope. Dependency packages emit missing-source-map warnings during tests; these did not prevent the checks from passing.
