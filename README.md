# NocoBase 3 documentation examples

Companion example projects for the [NocoBase 3 documentation](https://docs.nocobase.com/).

Build complete applications progressively alongside the documentation.

## Repository structure

```text
docs-examples-v3/
├── README.md
└── apps/
    ├── README.md
    └── <example-app>/
```

Each independently runnable application belongs in its own directory under `apps/`.
An application that spans several documentation chapters stays in one directory.
Its README maps each chapter to the relevant source files and verification steps.

Every example documents its supported versions, setup, configuration, startup,
and checks. Follow that example's README to run it; the repository root is not an
application or a pnpm workspace.

See [application conventions](apps/README.md).

## Examples

- [Team tasks](apps/team-tasks/README.MD): build your first app with an agent; tasks, assignees, progress and role-based access.

- [Agents guide](apps/agents-guide/README.md): model conversations, business Skills, and Runner setup.

- [Pages, routes and navigation](apps/pages-routes-navigation/README.MD): page registration, overlays, report tabs, access control and plugin component overrides, with reproducible documentation screenshots.

- [Themes and styles](apps/themes-and-styles/README.md): semantic tokens, brand presets, appearance hooks and preference defaults in a product catalog.

- [Localization](apps/localization/README.MD): product translations, plural counts, formatting, saved language preferences, partial Japanese resources and plugin overrides.

- [Customer Directory](apps/customer-directory/README.md): real data requests, URL query state, submission recovery, permission changes, and pagination correction.

- [Client services](apps/client-business-services/README.MD): shared client operations, React subscriptions, list refresh, cancellation and resource cleanup in a product catalog.

- [Product Catalog](apps/product-catalog/README.md): HTTP Web routes, custom APIs, Repository reads, downloads, permissions and API documentation.
