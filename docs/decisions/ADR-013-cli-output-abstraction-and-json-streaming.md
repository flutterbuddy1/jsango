# ADR-013: CLI Output Abstraction and Machine-Readable JSON Streaming

## Context

CLI tools frequently corrupt piped output when terminal colors, diagnostic logs, or progress banners are mixed with standard output. CI/CD pipelines, shell scripts, and IDE extensions require clean, machine-readable JSON streaming on `stdout` without manual regex stripping.

## Decision

1. **Strict Stream Separation**:
   - `stdout`: Reserved exclusively for command payload output (tables, success messages, or JSON).
   - `stderr`: Reserved exclusively for warnings, error banners, and diagnostic logs.
2. **First-Class `--json` Mode**:
   - In JSON mode (`output.isJson`), all non-JSON stdout messages are suppressed.
   - Output emitted by `output.json(data)` is valid JSON formatted with 2 spaces.
   - Errors continue to stream to `stderr`.
3. **Automatic Color Detection**:
   - ANSI color formatting automatically disables when `process.stdout.isTTY` is false, `process.env.NO_COLOR` is defined, or `--no-color` is supplied.

## Consequences

- Direct scriptability: `jsango route:list --json | jq .routes` works cleanly without errors.
- Uncorrupted logging in CI environments.
