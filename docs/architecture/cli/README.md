# @jsango/cli — Developer Tooling Architecture

## Overview

`@jsango/cli` is the official command-line interface for the jsango framework. It serves as the primary developer workflow engine for:

- Project scaffolding and generation (`create`)
- Application inspection (`route:list`, `model:list`, `model:show`, `config:show`)
- Database management and diagnostics (`db:status`)
- Schema lifecycle and migrations (`migrate:run`, `migrate:status`, `migrate:rollback`, `migrate:generate`, `migrate:check`)
- Environment and system diagnostics (`doctor`, `version`, `help`)
- Future plugin command extensions (`ICommandProvider`)

## Design Principles

1. **Decoupled Architecture**: CLI contains zero business logic belonging to ORM, Router, Migrations, or Database. Commands delegate directly to underlying framework packages.
2. **Deterministic & Namespaced**: Commands follow strict colon-delimited namespacing (`migrate:status`, `route:list`) with top-level DX aliases (`migrate`, `routes`, `models`).
3. **Lazy Initialization**: Commands never boot unnecessary infrastructure. `version` and `help` execute in microseconds with zero database, ORM, or HTTP dependencies.
4. **Machine-Readable Automation**: First-class support for `--json`, allowing IDEs, shell scripts, and CI/CD pipelines to consume structured stdout without ANSI sequence corruption.
5. **Security by Default**: Strict credential masking for sensitive configuration values and mandatory safety confirmations (`--yes`, `--force`) for destructive operations.

## Architecture Layers

```
CLI Entry Point (bin/jsango)
         ↓
  CliApplication
         ↓
  Global Option Parser
         ↓
  Command Registry (Namespaced & Aliased)
         ↓
  Command Argument & Option Parser
         ↓
  Command Context (Lazy Services, Signals, Root Discovery)
         ↓
  Application Services (ORM, Migrations, Router, Database, Config)
```

## Documentation Sitemap

1. [Command Architecture](./command-architecture.md)
2. [Command Registry](./command-registry.md)
3. [Argument Parsing](./argument-parsing.md)
4. [Output Abstraction](./output.md)
5. [Errors and Exit Codes](./errors-and-exit-codes.md)
6. [Project Discovery](./project-discovery.md)
7. [Plugin Commands](./plugin-commands.md)
8. [Security](./security.md)
9. [Performance](./performance.md)
10. [Testing](./testing.md)
