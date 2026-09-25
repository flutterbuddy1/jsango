# @django-js/websocket

> Real-time WebSocket infrastructure with multi-room management, backpressure guards, heartbeat, and transport adapters.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/websocket
```

## Usage

```typescript
import { RoomManager, LocalTransport } from '@django-js/websocket';

const rooms = new RoomManager();
const transport = new LocalTransport();
transport.publish('chat-room', { text: 'Hello!' });
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
