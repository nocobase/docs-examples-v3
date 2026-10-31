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
