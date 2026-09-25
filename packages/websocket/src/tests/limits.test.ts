import { describe, it, expect } from 'vitest';
import { WebSocketManager } from '../public/manager.js';
import { WebSocketConnection } from '../public/connection.js';
import { WebSocketLimitExceededError } from '../public/errors.js';

function mockSocket() {
  return {
    readyState: 1,
    bufferedAmount: 0,
    send: () => {},
    close: () => {},
  };
}

describe('WebSocket Connection Limits', () => {
  it('enforces maxTotalConnections limit', () => {
    const manager = new WebSocketManager({
      allowAnonymous: true,
      limits: { maxTotalConnections: 2 },
    });

    const conn1 = new WebSocketConnection({ socket: mockSocket(), id: 'c1' });
    const conn2 = new WebSocketConnection({ socket: mockSocket(), id: 'c2' });
    const conn3 = new WebSocketConnection({ socket: mockSocket(), id: 'c3' });

    manager.registerConnection(conn1);
    manager.registerConnection(conn2);

    expect(() => manager.registerConnection(conn3)).toThrow(WebSocketLimitExceededError);
  });

  it('enforces maxConnectionsPerIdentity limit', () => {
    const manager = new WebSocketManager({
      limits: { maxConnectionsPerIdentity: 1 },
    });

    const user = { id: 'u-sam', type: 'user', isAuthenticated: true };

    const conn1 = new WebSocketConnection({ socket: mockSocket(), id: 'c1', identity: user });
    const conn2 = new WebSocketConnection({ socket: mockSocket(), id: 'c2', identity: user });

    manager.registerConnection(conn1);

    expect(() => manager.registerConnection(conn2)).toThrow(WebSocketLimitExceededError);
  });

  it('enforces maxMessageSizeBytes limit', async () => {
    const manager = new WebSocketManager({
      allowAnonymous: true,
      limits: { maxMessageSizeBytes: 50 },
    });

    const conn = new WebSocketConnection({ socket: mockSocket(), id: 'c1' });
    manager.registerConnection(conn);

    const largePayload = JSON.stringify({
      type: 'test',
      payload: 'a'.repeat(100),
    });

    await expect(manager.processInboundMessage(conn, largePayload)).rejects.toThrow(
      WebSocketLimitExceededError
    );
  });
});
