# Errors and Exit Codes

## Overview

`@jsango/cli` adheres to POSIX exit code conventions and extends the framework's structured `JsangoError` hierarchy.

## Exit Code Strategy

| Exit Code | Constant                   | Meaning                                                                             |
| --------- | -------------------------- | ----------------------------------------------------------------------------------- |
| **0**     | `ExitCode.SUCCESS`         | Operation completed successfully.                                                   |
| **1**     | `ExitCode.GENERAL_ERROR`   | Unexpected runtime error or failed diagnostic.                                      |
| **2**     | `ExitCode.USAGE_ERROR`     | Malformed CLI arguments, missing arguments, unknown option or command.              |
| **3**     | `ExitCode.CONFIG_ERROR`    | Invalid or missing configuration, project root not found.                           |
| **4**     | `ExitCode.DATABASE_ERROR`  | Database connectivity failure, unresponsive ping.                                   |
| **5**     | `ExitCode.MIGRATION_ERROR` | Migration run error, rollback failure, or schema drift detected by `migrate:check`. |
| **130**   | `ExitCode.INTERRUPTED`     | Execution interrupted via `SIGINT` (Ctrl+C) or `SIGTERM`.                           |

## Error Class Hierarchy

```
JsangoError (from @jsango/core)
  └── CliError (public exitCode: ExitCode)
        ├── UsageError (exitCode: 2)
        │     ├── CommandNotFoundError
        │     ├── UnknownOptionError
        │     ├── MissingArgumentError
        │     └── InvalidOptionValueError
        ├── ProjectNotFoundError (exitCode: 3)
        ├── DestructiveOperationError (exitCode: 2)
        └── InterruptedError (exitCode: 130)
```

## Stack Trace Suppression

In normal mode, error messages are rendered as clean single-line diagnostics without internal stack traces:

```
✖ [ERROR] Unknown option "--unknown-flag".
```

Full stack traces are only printed to `stderr` when `--verbose` is provided.
