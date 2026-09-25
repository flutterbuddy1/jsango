# ADR-014: Project Discovery and Project Root Resolution

## Context

CLI commands can be executed from the project root, from nested subdirectories (e.g. `src/routes/`), or within monorepo workspaces. The CLI needs a reliable mechanism to identify the active project root without recursive or arbitrary disk scans that degrade performance.

## Decision

1. **Upward Traversal with Explicit Markers**:
   - `ProjectDiscovery.findProjectRoot(startDir)` starts at `cwd` and traverses upward toward the filesystem root.
   - It checks specifically for `jsango.config.ts`, `jsango.config.ts`, or a `package.json` that contains `@jsango/*` dependencies.
   - Upon locating the nearest marker, traversal terminates immediately.
2. **Path Traversal Guard**:
   - All file writes pass through `ProjectDiscovery.assertSafePath(targetPath, rootDir)` to ensure generated files (e.g. migrations, scaffolded apps) cannot escape designated boundaries via `../`.

## Consequences

- Commands like `jsango migrate` work seamlessly when invoked from subdirectories.
- Protects developers against accidental file overwrites outside project boundaries.
