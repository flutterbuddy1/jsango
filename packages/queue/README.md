# @django-js/queue

> At-least-once background job queues, concurrent worker polling, exponential backoff retries, and dead-letter store.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/queue
```

## Usage

```typescript
import { QueueManager, MemoryQueueDriver, Worker, defineJob } from '@django-js/queue';

const SendEmailJob = defineJob<{ email: string }>('send-email');
const manager = new QueueManager({ default: new MemoryQueueDriver() });

await manager.queue().dispatch(SendEmailJob.create({ email: 'user@test.com' }));
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
