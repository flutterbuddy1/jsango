# ADR-026: Distributed Realtime Transport Strategy

## Context

In multi-node deployments, WebSocket connections are distributed across multiple server instances. Broadcasting a message to a room requires propagating the message to all instances hosting connections subscribed to that room. The framework must support a pluggable transport layer that works out-of-the-box in single-node environments and scales cleanly to multi-node clusters.

## Decision

1. **Transport Abstraction (`IRealtimeTransport`)**:
   - The framework introduces an `IRealtimeTransport` contract providing:
     - `publish(channel: string, message: WebSocketOutboundMessage): Promise<void>`
     - `subscribe(channel: string, handler: (message) => void): () => void`
     - `unsubscribe(channel: string): void`
     - `close(): Promise<void>`
2. **Default In-Memory Transport (`LocalTransport`)**:
   - Ships with `LocalTransport` for zero-configuration, single-process applications, local development, and test suites.
3. **Pluggable Multi-Node Extension Point**:
   - Multi-node environments can supply a distributed transport driver (e.g. Redis Pub/Sub, NATS, Kafka) by implementing `IRealtimeTransport`.
   - `WebSocketManager` consumes `IRealtimeTransport` transparently without any changes to application controllers, rooms, or message handlers.
4. **Bi-Directional Event Bridges**:
   - `WebSocketEventBridge` and `WebSocketToEventBridge` provide clean integration between `@django-js/events` and `@django-js/websocket` without tight coupling.

## Consequences

- Applications start with zero external dependencies in development.
- Upgrading to multi-node horizontally-scaled deployments is achieved purely via configuration by swapping the `IRealtimeTransport` driver.
