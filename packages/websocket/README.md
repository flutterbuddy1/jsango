# @jsango/websocket

> Real-time WebSocket infrastructure with multi-room management, backpressure guards, heartbeat, and transport adapters.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/websocket
```

## Usage

```typescript
import { RoomManager, LocalTransport } from '@jsango/websocket';

const rooms = new RoomManager();
const transport = new LocalTransport();
transport.publish('chat-room', { text: 'Hello!' });
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
