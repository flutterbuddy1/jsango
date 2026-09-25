import { describe, it, expect } from 'vitest';
import { WebSocketManager } from '../public/manager.js';
import { WebSocketEventBridge, WebSocketToEventBridge } from '../public/bridges.js';
import { FakeWebSocketConnection } from '../public/testing/fake.js';

class MockEventBus {
  public handlers = new Map<string, ((event: any) => Promise<void> | void)[]>();
  public dispatched: any[] = [];

  public on(type: string, handler: (event: any) => Promise<void> | void): string {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
    return 'h-1';
  }

  public async dispatch(event: any): Promise<void> {
    this.dispatched.push(event);
    const list = this.handlers.get(event.type) ?? [];
    for (const h of list) {
      await h(event);
    }
  }
}

describe('WebSocket Bridges', () => {
  it('bridges EventBus events to WebSocket room broadcast', async () => {
    const bus = new MockEventBus();
    const manager = new WebSocketManager({ allowAnonymous: true });
    const bridge = new WebSocketEventBridge(manager, bus);

    const conn = new FakeWebSocketConnection({ id: 'c-bridge-1' });
    manager.registerConnection(conn as any);
    await manager.joinRoom('c-bridge-1', 'live-feed');

    bridge.bridgeToRoom('feed.updated', 'live-feed');

    await bus.dispatch({
      type: 'feed.updated',
      payload: { item: 'news' },
    });

    expect(conn.sentMessages).toHaveLength(1);
    expect(conn.sentMessages[0]?.type).toBe('feed.updated');
    expect(conn.sentMessages[0]?.payload).toEqual({ item: 'news' });
  });

  it('bridges inbound WebSocket messages to EventBus dispatch', async () => {
    const bus = new MockEventBus();
    const manager = new WebSocketManager({ allowAnonymous: true });
    const bridge = new WebSocketToEventBridge(manager, bus);

    bridge.bridge('user.action');

    const conn = new FakeWebSocketConnection({
      id: 'c-inbound-1',
      identity: { id: 'u42', type: 'user', isAuthenticated: true },
    });
    manager.registerConnection(conn as any);

    await manager.processInboundMessage(
      conn as any,
      JSON.stringify({
        type: 'user.action',
        payload: { click: 'button' },
      })
    );

    expect(bus.dispatched).toHaveLength(1);
    expect(bus.dispatched[0]?.type).toBe('user.action');
    expect(bus.dispatched[0]?.payload).toEqual({ click: 'button' });
    expect(bus.dispatched[0]?.metadata?.userId).toBe('u42');
  });
});
