# Page layouts

Companion App for [Page layouts](https://docs.nocobase.com/core/developing-apps/page-layouts/) ([中文](https://docs.nocobase.com/zh-CN/core/developing-apps/page-layouts/)).

Northstar Supply is a fictional product catalog demonstrating page containers, responsive filters, horizontal table scrolling, the application shell, inline child routes and three child-page presentations. Product data is fixed and read-only. Search and the long-heading switch live in the mounted catalog's React state: opening and closing a child retains them, leaving the catalog or reloading resets them. There is no product API, inventory write or business persistence.

The catalog requires a real template session. It deliberately uses `authz: 'skip'` because its fixtures are available to every signed-in user. `/catalog-guide` is public (`auth: 'optional'`). Template user/role administration remains permission-protected; this example does not change role grants or claim to demonstrate product authorization.

## Requirements

- Node.js 24 and pnpm 11; `package.json` pins the package manager version.
- Generated from `@nocobase/app-template-default@1.0.0-beta.85`; the lockfile resolves `@nocobase/app-client@4.0.0-beta.5`.
- No external service or API key. SQLite is the verified configuration for template accounts, sessions and settings. Product fixtures are independent of the database dialect; other drivers were not exercised for this example.
- The interface defaults to English when the browser uses English. Template language switching remains available, with Chinese application copy supplied.

## Install and run

From `apps/page-layouts`:

```bash
pnpm install --frozen-lockfile
pnpm nocobase config init --dialect sqlite
pnpm nocobase config check
pnpm dev
```

Open the application entry printed by the server, including its base path. Follow **Sign up** on the sign-in page to register a demonstration account, sign in, then choose **Product catalog** from the sidebar. With the default base path, the catalog is `/main/layouts` and the public guide is `/main/catalog-guide`.

For LAN access, set the actual host and an available port before starting:

```bash
pnpm nocobase config set app.publicOrigin=http://<LAN-IP>:13253
APP_SERVER_HOST=0.0.0.0 APP_SERVER_PORT=13253 pnpm dev
```

`config.yml`, generated secrets, databases, sessions and `storage/` stay local and are ignored. No sample product seed is required. The default administrator is unnecessary for viewing the catalog.

## Usage, source and observable results

The browser test captures the complete application window at its current viewport size (`fullPage: false`): 1440 × 900 for desktop examples and 375 × 812 for narrow-screen layout examples (375 × 667 for the drawer geometry check). Keep the header, navigation and visible content in the image; do not crop a component or expand scrolling content into a long screenshot. Selected images are maintained in `website-v3/doc/public/assets/core/developing-apps/page-layouts/`, shared by both documentation languages.

| Documentation usage                | App entry / operation                                            | Source                                                                         | Screenshot / output                      | Expected result and verification                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Page container, header and actions | Open Product catalog; click Long heading                         | `client/pages/layouts/product-page-frame.tsx`, `index.tsx`                     | `catalog.png`, `long-heading.png`        | One primary heading; actions wrap below it on narrow screens; component and browser checks                                   |
| Responsive filter/list composition | Search for `lamp`; narrow the window to 375px                    | `product-page-frame.tsx`, `index.tsx`                                          | `mobile.png`                             | Filters above the list below `lg`; two columns above it; geometry assertions                                                 |
| Long table and empty results       | Scroll the 48-row table; search `missing-product`                | `index.tsx`, `data.ts`, `client/components/data-table/`                        | `empty.png`, `mobile.png`                | Vertical scrolling in the shell; horizontal scrolling contained in the table; no document overflow                           |
| Brand and header actions           | Inspect Northstar Supply; click the book icon                    | `client/layouts/components/app-brand.tsx`, `header-actions.tsx`                | `catalog.png`, `standalone.png`          | Guide opens; theme/account controls remain available                                                                         |
| Sidebar collapse and phone menu    | Collapse navigation, reload; open navigation at 375px            | `client/layouts/components/app-sidebar.tsx`, `client/layouts/app-layout.tsx`   | `collapsed.png`, `mobile-navigation.png` | Existing desktop preference and mobile panel are retained                                                                    |
| Inline child sections              | Details → Handling notes; Back/Forward; reload                   | `client/pages/layouts/detail.tsx`, `overview.tsx`, `handling.tsx`, `routes.ts` | `inline-tabs.png`                        | One shared page container and heading; explicit section URL survives reload                                                  |
| Route dialog                       | Summary on a filtered, scrolled list; Done                       | `summary.tsx`, `product-info.tsx`                                              | `dialog.png`                             | Filter, scroll and trigger focus restored; direct URL/reload work                                                            |
| Route drawer                       | Click a product name; scroll notes; press Esc                    | `drawer.tsx`, `product-info.tsx`                                               | `drawer.png`, `drawer-mobile-dark.png`   | Fixed heading/footer, scrolling body; Done stays reachable at 375 × 667                                                      |
| Covering child page                | Details → Back to catalog                                        | `detail.tsx`, parent `index.tsx`                                               | `child-page.png`                         | Layer matches main content geometry; covered controls are inert; sidebar/header remain outside layer; parent scroll retained |
| Missing fixture                    | Open `/main/layouts/drawer/missing`                              | `product-info.tsx`                                                             | “This sample product does not exist.”    | Clear read-only missing-record state; Done returns to catalog                                                                |
| Public standalone page and sign-in | Guest opens Catalog guide, then Open product catalog             | `guide.tsx`, `routes.ts`, `client/routing/app-router.tsx`                      | `standalone.png`, `login.png`            | Public guide has no sidebar; protected catalog redirects guest to real sign-in                                               |
| Themes, spacing and translations   | Appearance → Dark; default preset; account → Language → 简体中文 | Existing theme controls and `client/locales/`                                  | `dark.png`, `default-preset.png`         | Semantic tokens, translated copy and responsive geometry remain usable                                                       |

Paths without a `client/` prefix in the table are relative to `client/pages/layouts/`. `RouteChildPage` relies on the parent's `Outlet` being beside its container. It is non-modal and leaves through the return link or history, not Esc. Dialog/drawer close replaces the history entry; Forward after that close is not a reopen operation.

## Checks and screenshots

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm exec tsc -p tsconfig.node.json --noEmit
pnpm exec vitest run tests/client/page-layouts.test.tsx tests/client/client-routes.test.ts tests/client/page-permission-titles.test.ts tests/client/app-locale-coverage.test.ts tests/client/layout-containers.test.tsx tests/client/route-overlay.test.tsx tests/project/agents-md.test.ts
pnpm build
```

Start the app, then run:

```bash
pnpm exec playwright install chromium
APP_URL=http://<LAN-IP>:13253/main/ SCREENSHOT_DIR=/tmp/page-layouts-screenshots pnpm exec playwright test tests/playwright/page-layouts.test.ts
```

`APP_URL` must include the actual application base path. Without it the browser tests skip. They register a unique disposable account in this example's local database, sign it in through the real authentication API and keep cookies in memory only. They leave that test account in the local database; use a disposable example installation rather than a production database. The account receives no additional role grants.

Verification on Linux, Node 24, pnpm 11 and SQLite: frontend and browser-test type checking; scoped ESLint/Prettier; the component-source checker; 37 tests in seven Vitest files; the application build; and the six Chromium browser scenarios above. Browser checks include real guest/session boundaries, empty/missing fixtures, filter/scroll/focus retention, direct entries, reload, browser history, sidebar controls, light/dark modes, both spacing presets and Chinese copy. The UI has no asynchronous product request or save, so slow/failing product requests are not simulated.

No business persistence, product-role authorization, external service, other database driver or non-Chromium browser was verified.
