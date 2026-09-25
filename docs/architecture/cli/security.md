# CLI Security

## Overview

Security is a primary requirement for developer tooling. CLI interactions must protect against credential exposure, destructive mistakes, and file system tampering.

## Core Security Safeguards

### 1. Secret & Credential Masking

When inspecting configuration via `config:show` or diagnostics:

- Any keys matching sensitive patterns (`password`, `secret`, `token`, `api_key`, `jwt`, `private_key`, `dsn`, `auth`) are replaced with `********`.
- Connection URLs with embedded credentials (e.g. `postgres://user:pass@host:5432/db`) have their password segments automatically redacted.

### 2. Destructive Command Protection

Operations that drop tables, alter schema, or rollback migrations require explicit confirmation flags:

- `migrate:run` with destructive operations requires `--yes` or `--force`.
- `migrate:rollback` with irreversible operations requires `--yes` or `--force`.
- Attempting destructive actions without these flags throws `DestructiveOperationError` (exit code 2) and aborts.

### 3. File System & Path Traversal Defense

- Project generation (`create <name>`) strictly validates directory names against alphanumeric, hyphens, and underscores.
- `ProjectDiscovery.assertSafePath()` validates that all target paths resolve strictly within the designated project root.
- Existing non-empty directories are never overwritten during scaffolding unless `--force` is explicitly passed.

### 4. Zero Shell Injection

The CLI never passes arbitrary user input to a system shell (`sh -c` or `bash`). All child processes and commands use explicit argument vectors with `child_process.execFile` or `child_process.spawn`.
