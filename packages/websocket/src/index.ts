export {
  type WebSocketState,
  type WebSocketIdentity,
  type WebSocketInboundMessage,
  type WebSocketOutboundMessage,
  type IWebSocketConnection,
  type ConnectionLimits,
  type HeartbeatConfig,
  type WebSocketHandler,
  type WebSocketMiddlewareNext,
  type WebSocketMiddlewareHandler,
  type WebSocketAuthHandler,
  type WebSocketRoomAuthHandler,
  type IRealtimeTransport,
  type WebSocketStats,
  type WebSocketServerConfig,
  type IWebSocketServer,
} from './public/types.js';

export {
  WebSocketError,
  WebSocketConnectionError,
  WebSocketAuthenticationError,
  WebSocketAuthorizationError,
  WebSocketMessageError,
  WebSocketLimitExceededError,
  WebSocketRoomError,
} from './public/errors.js';

export { WebSocketContext, type WebSocketContextOptions } from './public/context.js';
export {
  WebSocketConnection,
  type WebSocketConnectionOptions,
  type UnderlyingSocket,
} from './public/connection.js';
export { RoomManager } from './public/room.js';
export { LocalTransport } from './public/transport.js';
export { HeartbeatManager } from './public/heartbeat.js';
export { WebSocketMiddlewarePipeline } from './public/middleware.js';
export { WebSocketManager } from './public/manager.js';
export {
  WebSocketEventBridge,
  WebSocketToEventBridge,
  type EventBusLike,
} from './public/bridges.js';
export { NodeWebSocketAdapter, type NodeWebSocketAdapterOptions } from './internal/node-adapter.js';
