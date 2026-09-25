import { describe, it, expect } from 'vitest';
import { WebSocketConnection } from '../public/connection.js';
import { WebSocketConnectionError, WebSocketLimitExceededError } from '../public/errors.js';

describe('WebSocketConnection', () => {
  it('sends serializable JSON messages through underlying socket', async () => {
    const sentData: string[] = [];
    const mockSocket = {
      readyState: 1,
      send: (data: string | Uint8Array, cb?: (err?: Error) => void) => {
        sentData.push(data.toString());
        cb?.();
      },
      close: () => {},
    };

    const conn = new WebSocketConnection({
      id: 'test-conn-1',
      socket: mockSocket,
      identity: { id: 'u1', type: 'user', isAuthenticated: true },
    });

    expect(conn.id).toBe('test-conn-1');
    expect(conn.identity?.id).toBe('u1');
    expect(conn.state).toBe('connected');

    await conn.send({
      type: 'greeting',
      payload: { text: 'hello' },
    });

    expect(sentData).toHaveLength(1);
    const parsed = JSON.parse(sentData[0]!);
    expect(parsed.type).toBe('greeting');
    expect(parsed.payload.text).toBe('hello');
  });

  it('rejects sending when connection is closed', async () => {
    const mockSocket = {
      readyState: 3,
      send: () => {},
      close: () => {},
    };

    const conn = new WebSocketConnection({
      socket: mockSocket,
    });

    conn.markClosed();

    await expect(conn.send({ type: 'ping', payload: {} })).rejects.toThrow(
      WebSocketConnectionError
    );
  });

  it('enforces backpressure when bufferedAmount exceeds configured threshold', async () => {
    const mockSocket = {
      readyState: 1,
      bufferedAmount: 1024 * 1024, // 1MB buffered
      send: () => {},
      close: () => {},
    };

    const conn = new WebSocketConnection({
      socket: mockSocket,
      maxBufferedAmountBytes: 512 * 1024, // 512KB max
    });

    await expect(conn.send({ type: 'burst', payload: {} })).rejects.toThrow(
      WebSocketLimitExceededError
    );
  });
});
