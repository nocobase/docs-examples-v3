# Server localization

A command-driven NocoBase Application for [Server localization](https://docs.nocobase.com/core/developing-apps/server-localization/). Preview a report-ready notification in HTTP requests and render background messages in each recipient's language.

## Requirements and scope

Use Node.js 24 and pnpm 11.7.0. Dependencies are pinned: App Server `3.0.0-beta.5`, I18n `2.0.0-beta.1`, Session `0.1.0-beta.3`, ServiceProvider `0.0.2-beta.2`, Hono `4.13.2` and Zod `4.6.5`. The package versions match those used by Default template `1.0.0-beta.85`. Relevant APIs were also inspected at NocoBase source commit [`015404ecd0dbed33cc46831f73907329c577d375`](https://github.com/nocobase/nocobase/tree/015404ecd0dbed33cc46831f73907329c577d375); tests run the published packages, not that checkout.

This is a minimal App composition, not a copy of the full Default template. It uses real `Application`, `I18nProvider`, `SessionProvider`, plugin contributions, route validation and error handling. Standard `Request` objects go through `Application.fetch` in the same process. Commands open no network listener, need no public URL, and shut down their App before exiting.

No database, browser, account or external service is required. Report `Q3` is demonstration data; the app does not read reports, generate files, enqueue jobs or send email. Background commands invoke the registered service without an HTTP context. The locale-only `@example/report-delivery` plugin is an embedded fixture, not an npm dependency; its translations and the App's overrides use real runtime loading. Japanese exists only in that plugin to demonstrate that plugins do not extend the App's offered languages.

The demo preference endpoint changes only the caller's in-memory session. The framework creates an ephemeral cookie key for this process; preferences disappear after the command exits. These public preview routes contain no authentication and expose no private data. In an existing App, use its language-selection mechanism and authorization for actual report access.

## Install and run

From `apps/server-localization`:

```sh
pnpm install --frozen-lockfile
pnpm demo request zh-CN
```

The default report name is `Q3`; pass a different name as the third argument, for example `pnpm demo request en-US "Sales summary"`. HTTP requests require a trimmed name of 1–80 characters. The background service accepts a trusted report name supplied by its caller.

The first command returns:

```json
{
  "data": {
    "locale": "zh-CN",
    "message": "报表 Q3 已准备好。"
  }
}
```

Each demo starts a fresh App. There is no database setup or persistent session to clear.

## Commands and source map

| Documentation usage                                          | Command or test              | Source                                                                             | Expected output and verification                                                                                                                   |
| ------------------------------------------------------------ | ---------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resource keys, interpolation and loaders                     | `pnpm demo request zh-CN`    | `server/locales/`, `server/app.ts`                                                 | HTTP 200 and `报表 Q3 已准备好。`; tests also check English and weighted language preferences                                                      |
| Default language and unsupported-language fallback           | `pnpm demo request fr-FR`    | `server/app.ts`                                                                    | English response; tests also start an App defaulting to Chinese                                                                                    |
| Session before request header                                | `pnpm demo session zh-CN`    | `server/routes/report-messages.ts`, `scripts/demo.ts`                              | Saves English through a real session cookie, then receives English despite the Chinese header                                                      |
| Background runtime injection and cold locale loading         | `pnpm demo background zh-CN` | `server/providers/report-message.ts`, `server/services/report-message.ts`          | Chinese subject and message without an HTTP request                                                                                                |
| Concurrent recipients                                        | `pnpm demo concurrent`       | `server/services/report-message.ts`, `scripts/demo.ts`                             | English, Chinese, English for `en-US`, `zh-CN`, `fr-FR`; tests mix 30 concurrent background calls and HTTP requests                                |
| Plugin overrides and unchanged plugin keys                   | `pnpm demo override zh-CN`   | `server/report-delivery.ts`, `server/locales/`, `server/routes/report-messages.ts` | Overridden `报表 Q3 已可在客户门户中查看。` plus the plugin's untouched `客户门户` channel                                                         |
| Stable API error and translated user message                 | `pnpm demo error zh-CN`      | `server/routes/report-messages.ts`                                                 | HTTP 400, `REPORT_NOT_READY`, `reports`, English developer message and Chinese `localizedMessage`                                                  |
| Invalid inputs, missing middleware and missing resource keys | `pnpm test`                  | `tests/localization.test.ts`                                                       | Invalid names and unsupported saved preferences reject; missing middleware throws; isolated incomplete resources fall back to English then the key |

`pnpm demo error zh-CN` deliberately triggers the report-not-ready condition; the command exits successfully after receiving the expected HTTP 400. It does not wait for report generation. No artificial delays are used because loading, not request latency, is the behavior demonstrated here.

## Use in a Default-template application

Keep the template's `server/app.ts`, `server/runtime.ts`, configuration and existing Providers. Merge the locale keys into the existing `server/locales/` files and retain the template's locale export type. Register the report routes in `server/routes/index.ts` and `ReportMessageProvider` in `server/providers/index.ts`. Do not replace the whole App with this minimal composition.

The template already registers `I18nProvider`, `SessionProvider`, session middleware followed by i18n middleware, and the runtime's `locales` entry. Set the default through its existing `i18n.defaultLocale` configuration or `APP_DEFAULT_LOCALE`. This minimal example takes the default as `createApp(defaultLocale)`; it does not install the template's configuration CLI. In a full template, `pnpm nocobase locales check` compares client and server language files; it does not validate loaders, keys or interpolation. In this example, type checking and runtime tests cover the resources.

`server/report-delivery.ts` makes the override demonstration self-contained. For a real plugin, use its registered package name and actual server keys. Keep client and server resources separate. The preference route is only a demo aid and is not a replacement for the App's existing language-selection API.

## Verification

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

The build compiles this command-driven App with TypeScript; it does not produce a NocoBase deployment archive. The compiled CLI can be checked with `node dist/scripts/demo.js request zh-CN`.

Verified on Linux with Node `24.21.0` and pnpm `11.7.0`: frozen-lockfile installation, type checking, all nine tests, TypeScript build, formatting and all six demo modes. English and Chinese messages, French fallback, session isolation, plugin overrides, validation errors and the compiled CLI were exercised. The tests use real resource loading and middleware, with no mocked translator. Incomplete language resources appear only in an isolated fallback test, not in the normal application.

Network hosting, browser language selection, durable session stores, authentication, report generation, queues and email delivery were not exercised and are not implemented by this example.
