# Output Abstraction & Formatting

## Overview

The `CliOutput` abstraction decouples presentation logic from command implementations. It standardizes stdout/stderr separation, ANSI color handling, table formatting, and machine-readable JSON streaming.

## Stream Separation

- **`stdout`**: Reserved strictly for command payload data (tables, success messages, clean JSON).
- **`stderr`**: Reserved for diagnostics, warnings, debug info, and errors.

This guarantees that redirected pipes or subshells (e.g. `jsango route:list --json > routes.json`) never receive error banners or ANSI escape codes.

## Output Modes

| Mode               | Flag            | Description                                                                             |
| ------------------ | --------------- | --------------------------------------------------------------------------------------- |
| **Text** (default) | N/A             | Human-readable terminal output with colored tables and badges.                          |
| **JSON**           | `--json`        | Valid, unadulterated JSON written directly to `stdout`. All logs suppressed.            |
| **Quiet**          | `--quiet`, `-q` | Suppresses normal text, success banners, and info notices. Errors still go to `stderr`. |
| **Verbose**        | `--verbose`     | Emits detailed debug messages and full stack traces for diagnostics.                    |

## Terminal Colors

Colors are managed by `TerminalColors`:

- Automatically disabled if `process.stdout.isTTY` is false.
- Automatically disabled if `process.env.NO_COLOR` is present or `NODE_ENV === 'test'`.
- Can be explicitly disabled with the `--no-color` flag.

## Reusable Tables

The internal `TableFormatter` automatically computes column widths, wraps cells, and aligns content neatly:

```
Method   Path             Name          Handler       Middleware
------   --------------   -----------   -----------   ----------
GET      /users           users.index   getUsers      1
POST     /users           users.store   createUser    2
```
