# @django-js/events

> Typed event definitions, tri-mode execution (sync, async, queued), priority handlers, and event middleware.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/events
```

## Usage

```typescript
import { EventBus, defineEvent } from '@django-js/events';

const UserRegistered = defineEvent<{ userId: string }>('user.registered');
const bus = new EventBus();

bus.on(UserRegistered, async (event) => {
  console.log('Registered user:', event.payload.userId);
});

await bus.dispatch(UserRegistered.create({ userId: 'user-123' }));
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
