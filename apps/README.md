# Application examples

Use one directory per independently runnable example application. Keep an
application that spans multiple documentation chapters in the same directory,
and link those chapters to the relevant files instead of duplicating the project.

Each application's README should include:

- Its purpose and links to the corresponding documentation chapters.
- A chapter-to-code map explaining the important implementation files.
- Required Node.js, pnpm, NocoBase, and plugin versions.
- Dependency installation, database configuration, and startup instructions.
- Required external services and how to supply local configuration.
- Commands for checks and tests, with the limits of verified behavior.

Keep dependencies and configuration local to each example. Publish source and
configuration templates; keep credentials, sessions, databases, installed
dependencies, and generated build output out of the repository.

## 应用示例约定

每个目录对应一个可独立运行的示例应用。项目 README 应说明文档与代码的对应关系、
版本要求、安装配置、启动方式和验证方法。跨章节的同一应用持续维护在一个目录中。

提交源码、锁文件和配置模板；运行配置、密钥、会话、数据库和构建产物保留在本地。
