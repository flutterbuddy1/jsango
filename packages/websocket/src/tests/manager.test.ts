import { describe, it, expect } from 'vitest';
import { WebSocketManager } from '../public/manager.js';
import { WebSocketConnection } from '../public/connection.js';
import { WebSocketAuthorizationError, WebSocketMessageError } from '../public/errors.js';

function createMockSocket(onSend?: (data: string) => void) {
  return {
    readyState: 1,
    bufferedAmount: 0,
    send: (data: string | Uint8Array, cb?: (err?: Error) => void) => {
      onSend?.(data.toString());
      cb?.();
    },
    close: () => {},
  };
}

describe('WebSocketManager', () => {
  it('manages connections and routes messages to registered type handlers', async () => {
    const manager = new WebSocketManager({ allowAnonymous: true });
    let handledPayload: unknown = null;

    manager.on<{ text: string }>('chat.message', async (ctx, msg) => {
      handledPayload = msg.payload;
      await ctx.reply('chat.reply', { ack: true });
    });

    const sentByClient: string[] = [];
    const socket = createMockSocket((data) => sentByClient.push(data));
    const conn = new WebSocketConnection({ socket, id: 'conn-1' });

    manager.registerConnection(conn);

    await manager.processInboundMessage(
      conn,
      JSON.stringify({
        type: 'chat.message',
        payload: { text: 'Hello Server' },
        requestId: 'req-99',
      })
    );

    expect(handledPayload).toEqual({ text: 'Hello Server' });
    expect(sentByClient).toHaveLength(1);
    const reply = JSON.parse(sentByClient[0]!);
    expect(reply.type).toBe('chat.reply');
    expect(reply.payload.ack).toBe(true);
    expect(reply.requestId).toBe('req-99');
  });

  it('broadcasts messages to room members', async () => {
    const manager = new WebSocketManager({ allowAnonymous: true });

    const client1Msgs: string[] = [];
    const client2Msgs: string[] = [];
    const client3Msgs: string[] = [];

    const conn1 = new WebSocketConnection({
      socket: createMockSocket((d) => client1Msgs.push(d)),
      id: 'c1',
    });
    const conn2 = new WebSocketConnection({
      socket: createMockSocket((d) => client2Msgs.push(d)),
      id: 'c2',
    });
    const conn3 = new WebSocketConnection({
      socket: createMockSocket((d) => client3Msgs.push(d)),
      id: 'c3',
    });

    manager.registerConnection(conn1);
    manager.registerConnection(conn2);
    manager.registerConnection(conn3);

    await manager.joinRoom('c1', 'room-lobby');
    await manager.joinRoom('c2', 'room-lobby');
    // c3 is not in room-lobby

    await manager.broadcast('room-lobby', {
      type: 'lobby.announcement',
      payload: { note: 'welcome' },
    });

    expect(client1Msgs).toHaveLength(1);
    expect(client2Msgs).toHaveLength(1);
    expect(client3Msgs).toHaveLength(0);
  });

  it('broadcasts excluding a sender connection ID', async () => {
    const manager = new WebSocketManager({ allowAnonymous: true });

    const client1Msgs: string[] = [];
    const client2Msgs: string[] = [];

    const conn1 = new WebSocketConnection({
      socket: createMockSocket((d) => client1Msgs.push(d)),
      id: 'c1',
    });
    const conn2 = new WebSocketConnection({
      socket: createMockSocket((d) => client2Msgs.push(d)),
      id: 'c2',
    });

    manager.registerConnection(conn1);
    manager.registerConnection(conn2);

    await manager.joinRoom('c1', 'room-lobby');
    await manager.joinRoom('c2', 'room-lobby');

    await manager.broadcastExcluding('room-lobby', { type: 'msg', payload: {} }, 'c1');

    expect(client1Msgs).toHaveLength(0); // Excluded sender
    expect(client2Msgs).toHaveLength(1);
  });

  it('enforces authorizeRoomJoin hook', async () => {
    const manager = new WebSocketManager({
      allowAnonymous: true,
      authorizeRoomJoin: (conn, room) => {
        return room !== 'secret-admin-room';
      },
    });

    const conn = new WebSocketConnection({ socket: createMockSocket(), id: 'c1' });
    manager.registerConnection(conn);

    await expect(manager.joinRoom('c1', 'secret-admin-room')).rejects.toThrow(
      WebSocketAuthorizationError
    );
  });

  it('rejects invalid JSON payloads', async () => {
    const manager = new WebSocketManager({ allowAnonymous: true });
    const conn = new WebSocketConnection({ socket: createMockSocket(), id: 'c1' });
    manager.registerConnection(conn);

    await expect(manager.processInboundMessage(conn, 'invalid-non-json')).rejects.toThrow(
      WebSocketMessageError
    );
  });
});
