# @jsango/events

> Typed event definitions, tri-mode execution (sync, async, queued), priority handlers, and event middleware.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/events
```

## Usage

```typescript
import { EventBus, defineEvent } from '@jsango/events';

const UserRegistered = defineEvent<{ userId: string }>('user.registered');
const bus = new EventBus();

bus.on(UserRegistered, async (event) => {
  console.log('Registered user:', event.payload.userId);
});

await bus.dispatch(UserRegistered.create({ userId: 'user-123' }));
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
