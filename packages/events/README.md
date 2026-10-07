# @jsango/events

> Typed event payloads, tri-mode execution (sync, async, queued), priority handlers, and event middleware.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/events
```

## Usage

```typescript
import { EventBus, createEvent } from '@jsango/events';

type UserRegistered = { userId: string };

const bus = new EventBus();

bus.use(async (event, next) => {
  console.log('dispatching', event.type);
  await next();
});

bus.on<UserRegistered>(
  'user.registered',
  async (event) => {
    console.log('Registered user:', event.payload.userId);
  },
  { mode: 'async', priority: 10 } // 'sync' (default) | 'async' | 'queued'
);

await bus.emit<UserRegistered>({ type: 'user.registered', payload: { userId: 'user-123' } });

// Or build the event yourself and dispatch it:
await bus.dispatch(createEvent({ type: 'user.registered', payload: { userId: 'user-456' } }));
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
