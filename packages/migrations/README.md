# @jsango/migrations

> Schema diffing engine, DDL compilers, migration generator, distributed migration locking, and reversible runner.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/migrations
```

## Usage

```typescript
import { MigrationRunner, MigrationRegistry, MigrationStorage } from '@jsango/migrations';

const runner = new MigrationRunner(driver, registry, storage);
await runner.run();
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
