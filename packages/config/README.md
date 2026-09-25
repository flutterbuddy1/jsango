# @django-js/config

> Centralized, immutable configuration provider with type casting and schema validation.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/config
```

## Usage

```typescript
import { ConfigProvider } from '@django-js/config';

const config = new ConfigProvider({
  APP_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 3000,
});
const port = config.get('PORT');
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
