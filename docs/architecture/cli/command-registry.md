# Command Registry & Namespacing

## Overview

The `CommandRegistry` manages command registration, lookup, aliases, and namespace partitioning. It guarantees deterministic registration ordering and eliminates filesystem-order dependencies.

## Key Capabilities

1. **Deterministic Indexing**: Commands are stored in memory and returned sorted alphabetically by primary name.
2. **Colon-Delimited Namespaces**: Commands follow hierarchical namespacing (`migrate:status`, `route:list`, `model:list`).
3. **Space-Delimited Fallback**: Running `django-js migrate status` transparently maps to `migrate:status`.
4. **Collision Prevention**: Re-registering an existing command name or conflicting alias throws an explicit error immediately.
5. **Typo Suggestions**: When an unknown command is invoked, the registry uses Levenshtein distance to find the closest valid command and suggests it:
   ```
   ✖ [ERROR] Unknown command "route:lis". Did you mean "route:list"?
   ```

## Public API

```typescript
export class CommandRegistry {
  register(command: ICommand): this;
  registerAll(commands: readonly ICommand[]): this;
  unregister(name: string): boolean;
  resolve(name: string): ICommand | undefined;
  has(name: string): boolean;
  list(namespace?: string): readonly ICommand[];
  getNamespaces(): readonly string[];
  findClosestCommand(name: string): string | undefined;
  clear(): void;
}
```
