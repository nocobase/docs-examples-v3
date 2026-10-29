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

Keep dependencies and configuration local to each example. Publish source, lockfiles, and
configuration templates; keep credentials, sessions, databases, installed
dependencies, and generated build output out of the repository.
