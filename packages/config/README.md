# @jsango/config

> Centralized, read-only configuration provider with string/number/boolean type casting.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/config
```

## Usage

```typescript
import { createConfigProvider, createConfigFromRuntime } from '@jsango/config';
import { createRuntimeAdapter } from '@jsango/runtime';

const config = createConfigProvider({
  APP_ENV: 'development',
  PORT: '3000',
});
const port = config.getNumber('PORT', 3000); // '3000' -> 3000
const debug = config.getBoolean('DEBUG', false);

// Or read every environment variable through the runtime adapter.
const env = createConfigFromRuntime(createRuntimeAdapter());
const dbUrl = env.getString('DATABASE_URL', 'sqlite://./dev.db');
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
