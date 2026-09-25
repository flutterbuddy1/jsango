# Project Discovery & Root Resolution

## Overview

The CLI automatically detects the active django-js project root without arbitrary or recursive filesystem scanning.

## Discovery Algorithm

1. Starting from the current working directory (`process.cwd()`), `ProjectDiscovery.findProjectRoot()` inspects the current directory for:
   - `nexora.config.ts`, `nexora.config.js`, `django-js.config.ts`, `django-js.config.js`
   - A `package.json` with `@django-js/*` dependencies or framework markers.
2. If not found, it steps upward to the parent directory until:
   - A valid project root is located.
   - The filesystem root is reached.
3. If no project root is discovered, the CLI falls back safely to standalone mode with `projectRoot = cwd`.

## Path Traversal Defense

When commands write files (such as `migrate:generate` or `create`), they pass paths through `ProjectDiscovery.assertSafePath(targetPath, rootDir)`:

- Verifies normalized absolute path starts with `rootDir`.
- Throws an error immediately if `..` traversal escapes the project boundaries.
