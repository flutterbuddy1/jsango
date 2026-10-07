# @jsango/runtime

> Runtime independence abstraction layer isolating Node.js and modern JavaScript runtime environments.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/runtime
```

## Usage

```typescript
import { createRuntimeAdapter, detectRuntime } from '@jsango/runtime';

const runtime = createRuntimeAdapter();
console.log(detectRuntime(), runtime.name, runtime.version); // 'node' | 'bun' | 'unknown'

const port = runtime.getEnv('PORT') ?? '3000';
const root = runtime.cwd();
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
