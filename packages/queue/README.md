# @jsango/queue

> At-least-once background job queues, concurrent worker polling, exponential backoff retries, and dead-letter store.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/queue
```

## Usage

```typescript
import { QueueManager } from '@jsango/queue';

const manager = new QueueManager({
  default: 'default',
  connections: { default: { driver: 'memory' } },
});

manager.registry.register<{ email: string }>({
  type: 'send-email',
  maxAttempts: 5,
  retryPolicy: { backoffType: 'exponential', initialDelayMs: 1000 },
  handler: async ({ payload, attempt, logger }) => {
    logger.info(`sending to ${payload.email} (attempt ${attempt})`);
  },
});

const jobId = await manager.queue().dispatch('send-email', { email: 'user@test.com' });
await manager.queue().dispatch('send-email', { email: 'later@test.com' }, { delayMs: 60_000 });

const worker = manager.startWorker({ concurrency: 4 }); // polls until stopped
// on shutdown:
await manager.close();
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
