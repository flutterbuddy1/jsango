# @django-js/container

> High-performance dependency injection container with transient, singleton, and scoped resolution lifecycles.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/container
```

## Usage

```typescript
import { Container } from '@django-js/container';

const container = new Container();
container.singleton('UserService', UserService);

const scope = container.createScope();
const svc = scope.resolve('UserService');
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
