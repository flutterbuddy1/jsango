# ADR-011: CLI Command Architecture and Separation of Concerns

## Context

The framework requires an official, production-grade command-line interface (`@django-js/cli`) to facilitate project creation, database migrations, model inspection, route listing, and diagnostics. A naive CLI implementation often leads to duplicated business logic (re-implementing ORM querying, route matching, or migration diffing inside CLI classes) and tight coupling to specific runtime APIs.

## Decision

1. **Strict Decoupling**: CLI commands shall contain zero domain or business logic. All database operations, migration executions, route enumerations, and configuration parsings must call existing framework packages (`@django-js/core`, `@django-js/config`, `@django-js/database`, `@django-js/orm`, `@django-js/migrations`, `@django-js/router`, `@django-js/middleware`).
2. **Typed Command Abstraction**: Commands are defined via `ICommand` and `CommandDefinition`, specifying arguments, options, types, defaults, and examples declaratively.
3. **Execution Pipeline**: The execution flow follows:
   `CLI binary` $\to$ `CliApplication` $\to$ `Global Parser` $\to$ `CommandRegistry` $\to$ `ArgParser` $\to$ `CommandContext` $\to$ `ICommand.execute()`.

## Consequences

- The CLI package remains lightweight and independent from HTTP server handling.
- Underlying packages remain testable and usable without the CLI.
- No framework packages depend on `@django-js/cli`, maintaining unidirectional dependency layering.
