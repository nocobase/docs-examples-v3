# Themes and styles

A runnable companion to [Themes and styles](https://docs.nocobase.com/core/developing-apps/themes-and-styles/) ([中文](https://docs.nocobase.com/zh-CN/core/developing-apps/themes-and-styles/)).

The public product catalog demonstrates semantic styles, preset customization, appearance hooks, and browser preference precedence. It uses fictional English product data. Product edits stay in React state and reset on reload or **Reset products**; there is no product API or product database table. Appearance choices use the template's real provider and local storage.

## Prerequisites

- Node.js 24 or later and pnpm 11 (the package manager is pinned to 11.7.0).
- Default template baseline: `1.0.0-beta.85`.
- The committed lockfile records the installed NocoBase packages and frontend dependencies. Use it with `--frozen-lockfile`.
- No external services are needed. The standalone setup below uses SQLite for the template's services. The theme implementation itself is independent of the database.

## Setup and run

From this directory:

```bash
pnpm install --frozen-lockfile
pnpm nocobase config init --dialect sqlite --json
pnpm nocobase config check --json
pnpm dev
```

Open the application URL printed after startup and append `products`, for example `/main/products` when the printed base path is `/main/`. This page needs no sign-in. The normal template homepage and administration still require authentication; the catalog does not expose their data. The initial administrator is configured under `users.initialAdmin` in your local configuration.

The initial appearance is **System → Compact**, and the initial language is English. For LAN development, detect the machine's current LAN address, set `app.publicOrigin` to that origin, and start with `APP_SERVER_HOST=0.0.0.0 APP_SERVER_PORT=<port> pnpm dev`. Use the actual printed port and base path, and verify the LAN URL. Keep local addresses and generated configuration out of source control.

## Try the example

- Switch **Light**, **Dark**, and **System**. **Applied mode** reports the actual mode; System follows operating-system changes while the page is open.
- Switch **Compact**, **Spacious**, and **Brand**. Compact uses modified `0.21rem` spacing; Spacious uses `0.25rem`. Brand adds teal actions, serif headings and a `0.75rem` base radius.
- Open **Appearance** at the upper right. It uses the same state as the page controls and includes the registered Brand thumbnail. Keyboard arrows change its radio selections; Escape closes it and returns focus.
- Open **Arc desk lamp**. Clear Product, enter `-1` for Price, and select **Save**. Both errors appear and Product receives focus. Correct and save to update the in-memory list, or Escape to discard changes. Refresh restores the initial products.
- Reload or open another tab to check saved appearance. Changes in one tab synchronize with the other.

To test configured defaults:

```bash
pnpm nocobase config set client.app.defaultColorScheme=dark client.app.defaultTheme=brand --json
```

Wait for the development server to reload configuration. A fresh private browser window selects Dark and Brand without saving an explicit preference. A window where you already selected Light and Spacious keeps those choices after reload. Restore the initial defaults with:

```bash
pnpm nocobase config set client.app.defaultColorScheme=system client.app.defaultTheme=compact --json
```

Closing all private windows before opening another avoids sharing their temporary storage.

## Documentation-to-code map

Browser captures are written to `storage/theme-review/` by the test below. Published screenshots live in the website repository under `doc/public/assets/core/themes-and-styles/`; they are reused by both documentation languages.

| Usage                            | Entry or action                                              | Source                                                                                                                                          | Observable result / capture                                                                                                               |
| -------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Semantic colors and states       | `/products`; Light and Dark                                  | [Product page](client/pages/products/index.tsx), [edit form](client/pages/products/edit.tsx)                                                    | Panels, text, buttons, status badges and error text follow the mode; `compact-light.png`, `brand-error-light.png`, `brand-error-dark.png` |
| Spacing, radii and typography    | Compact, Spacious, Brand                                     | [Compact](client/theme/themes/compact.css), [Spacious](client/theme/themes/default.css), [Brand](client/theme/themes/brand.css)                 | Density changes; Brand has serif headings and larger corners; `default-light.png`, `brand-light.png`, `brand-dark.png`                    |
| Change an existing preset        | Compact                                                      | [Compact CSS](client/theme/themes/compact.css)                                                                                                  | `--spacing: 0.21rem` affects real panel, button and table geometry; `compact-light.png`                                                   |
| Add a complete preset            | Brand; Appearance                                            | [Brand CSS](client/theme/themes/brand.css), [imports](client/styles.css), [registry](client/theme/theme-presets.ts), [locales](client/locales/) | Light/dark Brand styles and matching preview; `appearance-preview.png`                                                                    |
| Read/set color mode              | Light, Dark, System                                          | [ColorModeControls](client/pages/products/appearance-controls.tsx)                                                                              | `useTheme()` controls the selection; `resolvedTheme` follows OS mode; `system-light.png`                                                  |
| Read/set preset                  | Compact, Spacious, Brand                                     | [PresetControls](client/pages/products/appearance-controls.tsx)                                                                                 | `useThemePreset()` updates the page and built-in selector together; `appearance-preview.png`                                              |
| Defaults and saved choices       | Configuration commands above; fresh/existing browser windows | [Configuration](config.example.yml), [preference resolution](client/theme/theme-preferences.ts), [provider](client/theme/theme-provider.tsx)    | Saved valid choices win independently; fresh browsers use configured defaults                                                             |
| Responsive and keyboard behavior | 375px viewport; edit dialog; Escape                          | [Browser tests](tests/playwright/themes-and-styles.test.ts)                                                                                     | Page does not overflow; table scrolls internally; invalid input receives focus and Escape returns focus to its opener                     |

## Checks

Run the affected unit/component tests and type checks:

```bash
pnpm exec vitest run tests/client/theme-tokens.test.ts tests/client/theme-preferences.test.ts tests/client/client-theme.test.tsx tests/client/app-locale-coverage.test.ts tests/client/client-routes.test.ts tests/client/page-permission-titles.test.ts tests/client/products.test.tsx
pnpm exec tsc -p tsconfig.json --noEmit
pnpm build
```

With the development server running at its initial System/Compact defaults, install Chromium if needed and run the browser tests. Replace the environment variable's value with the actual application URL, including its base path and trailing slash:

```bash
pnpm exec playwright install chromium
THEME_DEMO_URL='<application URL including trailing slash>' pnpm exec playwright test tests/playwright/themes-and-styles.test.ts
```

The browser tests cover all three presets in both modes at 1200px and 375px, geometry, changed color-pair contrast, appearance previews, keyboard switching, edit errors and focus, saving and reload reset, cross-tab preferences, system-mode changes, defaults, and blocked storage. They do not sign in or exercise template administration. Browser tests use isolated contexts and leave no authentication state. Re-running them overwrites captures in `storage/theme-review/`.

## Verification record

Verified on Linux with Node.js 24.21.0, pnpm 11.7.0, SQLite and headless Chromium on 2026-10-30 (America/New_York):

- 57 tests across seven affected Vitest files passed, including the template's theme contract and preference fallback tests.
- Client type checking, scoped ESLint and formatting passed. `pnpm build` passed, including client/tooling/server type checks and deployment dependency verification.
- Five Playwright tests passed against the running application, with no page errors in the preset/layout test. Screenshots were also inspected.
- Real `config set` changes were checked separately: fresh browsers picked Dark/Brand, a browser with saved Light/Spacious retained them, and defaults were not saved as preferences. Initial configuration was restored afterward. The published `configured-defaults.png` comes from this check; the routine browser suite captures the current defaults instead.
- Brand primary/background text contrast measured 5.47:1 in light mode and 9.78:1 in dark mode. Accent contrast measured 7.27:1 and 7.52:1. These measurements apply to the changed color pairs, not every template component.

Not verified: Firefox, Safari, other databases, cross-device preference synchronization (not provided), or product persistence (outside this example's scope). Unit tests additionally cover invalid stored values, removed preset IDs, and isolation between application base paths; the browser run uses one base path.
