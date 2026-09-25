# ADR-025: WebSocket Abstraction & Room Architecture

## Context

Real-time capabilities (live dashboards, chat, notifications, streaming status updates) require WebSocket communication. The framework must provide a clean, runtime-independent abstraction layer over WebSocket engines, offering room partitioning, broadcasting, authentication during HTTP upgrade, connection limits, and backpressure protection.

## Decision

1. **Engine Isolation & Public Interfaces**:
   - The framework introduces `IWebSocketServer` and `IWebSocketConnection` to encapsulate all WebSocket interactions.
   - Low-level engine types (e.g. `ws.WebSocketServer` or Bun WebSocket) are never leaked into user controllers or handlers.
2. **Room Architecture**:
   - `RoomManager` maintains a high-performance in-memory bidirectional mapping between connection IDs and room names.
   - Connections can join and leave multiple rooms with limit checks (`maxRoomsPerConnection`).
   - Disconnections trigger automatic cleanup across all joined rooms (`leaveAll`).
3. **Structured JSON Framing**:
   - Inbound and outbound WebSocket messages use a typed structure:
     `{ type: string, payload?: unknown, requestId?: string, metadata?: Record<string, unknown> }`.
4. **WebSocketContext Pattern**:
   - Handlers receive a `WebSocketContext` mimicking the HTTP `RequestContext` API (`connection`, `identity`, `state: Map<string, unknown>`, `reply()`, `send()`).
5. **Connection Limits & Backpressure**:
   - Configurable defensive limits: `maxTotalConnections`, `maxConnectionsPerIdentity`, `maxRoomsPerConnection`, `maxMessageSizeBytes`.
   - Backpressure is enforced by checking `bufferedAmount` against `maxBufferedAmountBytes` before queuing outbound frames.
6. **Heartbeat Health Checks**:
   - `HeartbeatManager` runs periodic ping intervals, tracks pong acknowledgments, and actively terminates unacknowledged dead sockets.

## Consequences

- Full runtime portability (Node.js today, Bun/Deno adapters in the future).
- Memory exhaustion is guarded against via backpressure, message size limits, and heartbeat sweeps.
- Integration tests can utilize `FakeWebSocketConnection` and `FakeWebSocketServer` without starting physical TCP ports.
