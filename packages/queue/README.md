# @jsango/queue

> At-least-once background job queues, concurrent worker polling, exponential backoff retries, and dead-letter store.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/queue
```

## Usage

```typescript
import { QueueManager, MemoryQueueDriver, Worker, defineJob } from '@jsango/queue';

const SendEmailJob = defineJob<{ email: string }>('send-email');
const manager = new QueueManager({ default: new MemoryQueueDriver() });

await manager.queue().dispatch(SendEmailJob.create({ email: 'user@test.com' }));
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
