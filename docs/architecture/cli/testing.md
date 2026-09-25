# CLI Testing Strategy

## Overview

The `@django-js/cli` package is tested across multiple abstraction layers, from unit tests of core primitives to full child-process integration tests executing the compiled CLI binary.

## Test Layers

1. **Parser Tests (`packages/cli/src/tests/parser.test.ts`)**:
   - Positional arguments (required, optional, variadic, type coercion).
   - Long and short options, inline `=` values.
   - Boolean flags and boolean negation (`--no-flag`).
   - Enum choice enforcement.
   - Repeated options array gathering.
   - Typos and suggested options.
2. **Registry Tests (`packages/cli/src/tests/registry.test.ts`)**:
   - Command registration and resolution by primary name and alias.
   - Duplicate command and conflicting alias rejection.
   - Namespace filtering and deterministic sorting.
   - Levenshtein-based typo suggestion.
3. **Output Tests (`packages/cli/src/tests/output.test.ts`)**:
   - Proper stream separation: stdout for payloads, stderr for errors/warnings.
   - Machine-readable JSON streaming without ANSI contamination.
   - Quiet mode suppression behavior.
   - Table formatting and column padding.
4. **Command Tests (`packages/cli/src/tests/commands.test.ts`)**:
   - Execution of `version`, `help`, `doctor`, `route:list`, `model:list`, `model:show`, `config:show`, `db:status`, `migrate:run`, `migrate:status`, `migrate:rollback`, and `create`.
5. **Security Tests (`packages/cli/src/tests/security.test.ts`)**:
   - Deep credential masking in configs and connection strings.
   - Path traversal defenses in `assertSafePath` and project creation.
   - Destructive migration blocking when `--force` / `--yes` is absent.
6. **Process Integration Tests (`packages/cli/src/tests/process.test.ts`)**:
   - Spawns compiled `dist/bin/django-js.js` as an external child process.
   - Verifies real OS exit codes, stdout/stderr streams, and JSON parsing.
