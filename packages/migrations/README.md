# @django-js/migrations

> Schema diffing engine, DDL compilers, migration generator, distributed migration locking, and reversible runner.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/migrations
```

## Usage

```typescript
import { MigrationRunner, MigrationRegistry, MigrationStorage } from '@django-js/migrations';

const runner = new MigrationRunner(driver, registry, storage);
await runner.run();
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
