# @jsango/container

> High-performance dependency injection container with transient, singleton, and scoped resolution lifecycles.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/container
```

## Usage

```typescript
import { Container } from '@jsango/container';

class Database {}
class UserService {
  constructor(public readonly db: Database) {}
}

const container = new Container();
container.registerSingleton(Database, () => new Database());
container.registerScoped('UserService', (c) => new UserService(c.resolve(Database)));
container.registerTransient('requestId', () => crypto.randomUUID());

const scope = container.createScope(); // e.g. one per request
const svc = scope.resolve<UserService>('UserService');

await scope.dispose();
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
