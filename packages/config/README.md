# @jsango/config

> Centralized, immutable configuration provider with type casting and schema validation.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/config
```

## Usage

```typescript
import { ConfigProvider } from '@jsango/config';

const config = new ConfigProvider({
  APP_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 3000,
});
const port = config.get('PORT');
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
