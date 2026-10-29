# NocoBase 3 documentation examples

Companion example projects for the [NocoBase 3 documentation](https://docs.nocobase.com/).

NocoBase 3 文档配套示例代码，按文档章节逐步构建完整应用。

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

## 示例组织方式

- 每个可独立运行的示例应用放在 `apps/` 下的一个目录中。
- 贯穿多个文档章节的同一应用共用一个目录，在 README 中关联章节与代码。
- 各示例分别说明版本要求、安装配置、启动方法和验证步骤。
- 运行示例时进入对应目录，按该项目的 README 操作。

- [团队任务应用](apps/team-tasks/README.MD)：使用 Agent 搭建第一个应用，体验任务分配、进度与角色权限。
