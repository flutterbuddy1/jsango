# @django-js/websocket Architecture Overview

## 1. Core Mission & Philosophy

`@django-js/websocket` delivers a production-grade real-time communication subsystem for the Nexora (`django-js`) framework. It provides runtime-independent WebSocket abstractions, room management, broadcasting, connection limits, heartbeat monitoring, backpressure enforcement, and HTTP upgrade authentication.

Key design principles:

- **Engine Isolation**: Underlying WebSocket engines (such as the Node.js `ws` library) are completely isolated behind the `IWebSocketServer` and `IWebSocketConnection` interfaces.
- **Room Management**: Dynamic pub/sub rooms with multi-room membership, join authorization, and auto-cleanup upon disconnection.
- **Connection Limits**: Built-in defensive limits for total connections, per-identity connections, message size, and room count per client.
- **Backpressure & Heartbeat**: Monitored socket buffer sizes (`bufferedAmount`) to prevent out-of-memory errors, alongside ping/pong heartbeat health checks.
- **Auth Reusability**: Seamlessly interoperates with `@django-js/auth` identities without duplicate identity models.
- **Event Bridges**: Bi-directional adapters connecting the WebSocket server with the `@django-js/events` EventBus.

---

## 2. Architecture Layers

```
Client WebSocket Connection
         ↓
HTTP Server Upgrade Request (NodeHttpServer)
         ↓
Authentication Hook (Token / Headers / Query)
         ↓
NodeWebSocketAdapter (ws wrapper)
         ↓
WebSocketManager
   ├── HeartbeatManager (ping/pong health checks)
   ├── RoomManager (room membership & lookups)
   ├── LocalTransport (IRealtimeTransport abstraction)
   ├── WebSocketMiddlewarePipeline (message interceptors)
   └── Type-specific WebSocketHandlers
```

---

## 3. Key Components

### 3.1 IWebSocketConnection & WebSocketConnection

- Represents an active client connection.
- Tracks connection state (`connecting`, `connected`, `closing`, `closed`), identity, joined rooms, metadata, and buffered amount.
- `send(message)` sends typed JSON frames: `{ type: string, payload?: unknown, requestId?: string }`.
- `close(code, reason)` and `terminate()`.

### 3.2 WebSocketContext

- Execution context passed to message handlers and middleware.
- Matches the ergonomics of HTTP `RequestContext` (provides `connectionId`, `connection`, `identity`, `state: Map<string, unknown>`, `reply()`, `send()`).

### 3.3 RoomManager

- High-performance bidirectional mapping between connections and rooms.
- Supports `join()`, `leave()`, `leaveAll()`, `getMembers()`, `getRooms()`, and connection limits.
- Automatically cleans up empty rooms.

### 3.4 WebSocketManager

- Central coordinator managing connection lifecycles, routing inbound messages, executing middleware, broadcasting to rooms, and tracking live metrics (`WebSocketStats`).

### 3.5 NodeWebSocketAdapter

- Implements `IWebSocketServer` by adapting Node's HTTP upgrade mechanism and `ws.WebSocketServer`.
- Handles upgrade requests, checks permissions/limits, and binds connection listeners.

### 3.6 Event & WebSocket Bridges

- `WebSocketEventBridge`: Forwards events emitted on the `EventBus` directly to WebSocket rooms or all connected clients.
- `WebSocketToEventBridge`: Routes incoming WebSocket client messages into the `EventBus` for server-wide processing.

---

## 4. Connection Limits & Security

| Configuration               | Description                                                | Default   |
| :-------------------------- | :--------------------------------------------------------- | :-------- |
| `maxTotalConnections`       | Maximum concurrent connections on this server instance     | Unlimited |
| `maxConnectionsPerIdentity` | Maximum concurrent connections per authenticated user ID   | Unlimited |
| `maxRoomsPerConnection`     | Maximum rooms a single connection may join                 | Unlimited |
| `maxMessageSizeBytes`       | Maximum allowed inbound JSON payload size in bytes         | Unlimited |
| `maxBufferedAmountBytes`    | Maximum send buffer before backpressure error is triggered | Unlimited |
| `allowAnonymous`            | Permit unauthenticated connections                         | `false`   |

---

## 5. Testing Utilities

- `FakeWebSocketConnection`: In-memory connection recording sent messages for unit testing.
- `FakeWebSocketServer`: Lightweight server harness for testing controllers and bridges.
