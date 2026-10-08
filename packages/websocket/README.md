# @jsango/websocket

> Real-time WebSocket infrastructure with multi-room management, backpressure guards, heartbeat, and transport adapters.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/websocket
```

## Usage

```typescript
import { NodeWebSocketAdapter } from '@jsango/websocket';

const ws = new NodeWebSocketAdapter({
  port: 8080,
  path: '/ws',
  allowAnonymous: true,
  limits: { maxMessageSizeBytes: 64 * 1024, maxRoomsPerConnection: 10 },
  heartbeat: { enabled: true, pingIntervalMs: 30_000 },
});
await ws.start();

// Clients send JSON frames: { "type": "chat.join", "payload": { "room": "lobby" } }
ws.manager.on<{ room: string }>('chat.join', async (ctx, message) => {
  await ws.manager.joinRoom(ctx.connectionId, message.payload.room);
  await ctx.reply('chat.joined', { room: message.payload.room });
});

ws.manager.on<{ room: string; text: string }>('chat.message', async (ctx, message) => {
  await ws.manager.broadcast(message.payload.room, {
    type: 'chat.message',
    payload: { text: message.payload.text },
  });
});
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
