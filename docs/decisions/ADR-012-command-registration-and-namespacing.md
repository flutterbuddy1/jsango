# ADR-012: Command Registration, Namespacing, and Aliases

## Context

In complex backend frameworks, CLI commands grow rapidly as plugins, ORMs, and migrations are added. A command naming strategy must be predictable, collision-resistant, and developer-friendly without filesystem-order side effects.

## Decision

1. **Colon-Delimited Namespaces**: All modular commands follow standard colon-delimited namespacing:
   - `migrate:run`, `migrate:status`, `migrate:rollback`, `migrate:generate`, `migrate:check`
   - `route:list`
   - `model:list`, `model:show`
   - `config:show`
   - `db:status`
2. **Top-Level Aliases**: For high-frequency commands, intuitive top-level aliases are registered:
   - `migrate` $\to$ `migrate:run`
   - `routes` $\to$ `route:list`
   - `models` $\to$ `model:list`
3. **Space-Delimited Fallback**: If a user runs `jsango migrate status`, the application seamlessly maps the tokens to `migrate:status`.
4. **Collision Protection**: `CommandRegistry` throws an explicit error if a command name or alias collides with an existing registration.
5. **Typo Suggestions**: Unknown commands invoke a Levenshtein distance check to suggest the closest matching command in the error output.

## Consequences

- Clean terminal discoverability and structured `--help` groupings.
- Deterministic registration independent of file globbing order.
- Immediate feedback when typos occur.
