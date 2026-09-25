# @jsango/container

> High-performance dependency injection container with transient, singleton, and scoped resolution lifecycles.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/container
```

## Usage

```typescript
import { Container } from '@jsango/container';

const container = new Container();
container.singleton('UserService', UserService);

const scope = container.createScope();
const svc = scope.resolve('UserService');
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
