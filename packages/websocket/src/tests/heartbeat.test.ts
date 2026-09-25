import { describe, it, expect } from 'vitest';
import { HeartbeatManager } from '../public/heartbeat.js';
import { WebSocketConnection } from '../public/connection.js';

describe('HeartbeatManager', () => {
  it('detects dead connections and terminates them on missing pong', () => {
    const heartbeat = new HeartbeatManager({ pingIntervalMs: 100 });

    let pingCalled = false;
    let terminateCalled = false;

    const mockSocket = {
      readyState: 1,
      send: () => {},
      close: () => {},
      ping: () => {
        pingCalled = true;
      },
      terminate: () => {
        terminateCalled = true;
      },
    };

    const conn = new WebSocketConnection({ socket: mockSocket, id: 'c-hb-1' });

    heartbeat.register(conn);

    // Initial check: sets isAlive = false and pings
    heartbeat['checkConnections']();
    expect(pingCalled).toBe(true);
    expect(conn.isAlive).toBe(false);

    // Second check without pong: terminates dead socket
    heartbeat['checkConnections']();
    expect(terminateCalled).toBe(true);

    heartbeat.stop();
  });

  it('resets isAlive state when onPong is received', () => {
    const heartbeat = new HeartbeatManager();
    const mockSocket = {
      readyState: 1,
      send: () => {},
      close: () => {},
      ping: () => {},
    };

    const conn = new WebSocketConnection({ socket: mockSocket, id: 'c-hb-2' });
    heartbeat.register(conn);

    conn.isAlive = false;
    heartbeat.onPong('c-hb-2');

    expect(conn.isAlive).toBe(true);
  });
});
