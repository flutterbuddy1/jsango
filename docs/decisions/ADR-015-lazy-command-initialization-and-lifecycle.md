# ADR-015: Lazy Command Initialization, Cancellation, and Lifecycle

## Context

Booting database connection pools, ORM registries, or HTTP server instances takes tens to hundreds of milliseconds. Simple CLI commands such as `django-js --version` and `django-js --help` must execute instantaneously. Furthermore, long-running CLI operations (such as migrations or diagnostics) must support graceful cancellation upon `SIGINT` (Ctrl+C).

## Decision

1. **Lazy Service Resolution**:
   - `CommandContext` exposes lazy getter methods (`getApplication()`, `getDatabaseManager()`, `getMigrationRegistry()`, `getConfig()`).
   - Heavy infrastructure is only initialized when a command explicitly calls these getters.
   - `version` and `help` commands execute with zero infrastructure initialization.
2. **Cancellation Signal & Teardown Lifecycle**:
   - `CommandContext` holds an `AbortSignal`.
   - `CliApplication` captures `SIGINT` and `SIGTERM`, aborts the signal, invokes registered `context.cleanup()` callbacks, and exits with POSIX code 130 (`ExitCode.INTERRUPTED`).
   - Database connection pools registered with `context.setDatabaseManager()` automatically close on cleanup.

## Consequences

- Ultra-fast CLI startup times (sub-millisecond for `version` and `help`).
- Clean teardown without dangling database locks or socket handles on Ctrl+C.
