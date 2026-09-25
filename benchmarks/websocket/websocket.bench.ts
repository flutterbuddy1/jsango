import { describe, bench, beforeAll } from 'vitest';
import {
  WebSocketManager,
  RoomManager,
  LocalTransport,
  WebSocketConnection,
} from '../../packages/websocket/src/index.js';

function createBenchmarkSocket() {
  return {
    readyState: 1,
    bufferedAmount: 0,
    send: (data: string | Uint8Array, cb?: (err?: Error) => void) => {
      cb?.();
    },
    close: () => {},
  };
}

describe('WebSocket Benchmarks', () => {
  const roomManager = new RoomManager();
  const transport = new LocalTransport();
  const manager = new WebSocketManager({ allowAnonymous: true });

  manager.on('bench.msg', async (ctx) => {
    await ctx.reply('bench.reply', { ack: true });
  });

  const conns: WebSocketConnection[] = [];

  beforeAll(async () => {
    for (let i = 0; i < 50; i++) {
      const conn = new WebSocketConnection({
        socket: createBenchmarkSocket(),
        id: `bench-conn-${i}`,
      });
      manager.registerConnection(conn);
      conns.push(conn);
      await manager.joinRoom(conn.id, 'bench-room');
      roomManager.join(conn.id, 'room-bench');
    }
  });

  describe('RoomManager', () => {
    bench('getMembers lookup', () => {
      roomManager.getMembers('room-bench');
    });

    bench('hasMember check', () => {
      roomManager.hasMember('room-bench', 'bench-conn-10');
    });
  });

  describe('LocalTransport', () => {
    beforeAll(() => {
      transport.subscribe('bench.channel', () => {});
    });

    bench('publish message', async () => {
      await transport.publish('bench.channel', { type: 'ping', payload: {} });
    });
  });

  describe('WebSocketManager', () => {
    const rawMsg = JSON.stringify({
      type: 'bench.msg',
      payload: { value: 42 },
      requestId: 'req-bench-1',
    });

    bench('processInboundMessage + route to handler', async () => {
      await manager.processInboundMessage(conns[0]!, rawMsg);
    });

    bench('broadcast to 50 room members', async () => {
      await manager.broadcast('bench-room', {
        type: 'bench.broadcast',
        payload: { text: 'hello all' },
      });
    });

    bench('broadcastAll to 50 connections', async () => {
      await manager.broadcastAll({
        type: 'bench.all',
        payload: { text: 'system alert' },
      });
    });
  });
});
