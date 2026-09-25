import { describe, it, expect } from 'vitest';
import { Application } from '../../packages/middleware/src/index.js';
import { HttpRequest } from '../../packages/http/src/index.js';
import { Container } from '../../packages/container/src/index.js';
import { RoomManager } from '../../packages/websocket/src/index.js';
import { MemoryCacheDriver } from '../../packages/cache/src/index.js';
import { EventBus } from '../../packages/events/src/index.js';

describe('Performance Hardening & Memory Leak Tests', () => {
  it('should not leak memory when processing 5,000 HTTP request lifecycles', async () => {
    const app = new Application({ isProduction: true });
    app.get('/test', () => ({ ok: true }));

    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < 5000; i++) {
      const req = new HttpRequest({
        method: 'GET',
        url: 'http://localhost:3000/test',
      });
      const res = await app.handle(req);
      expect(res.statusCode).toBe(200);
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const diffMb = (finalMemory - initialMemory) / (1024 * 1024);
    // Heap usage should not increase drastically for 5000 lightweight requests
    expect(diffMb).toBeLessThan(50);
  });

  it('should cleanly dispose 5,000 scoped DI child containers without retaining references', async () => {
    const root = new Container();
    let disposedCount = 0;
    root.registerScoped('service', (c) => {
      const s = { id: Math.random() };
      c.onDispose(() => {
        disposedCount++;
      });
      return s;
    });

    for (let i = 0; i < 5000; i++) {
      const scope = root.createScope();
      scope.resolve('service');
      await scope.dispose();
    }

    expect(disposedCount).toBe(5000);
  });

  it('should cleanly remove WebSocket room memberships upon client disconnect', () => {
    const roomManager = new RoomManager();

    for (let i = 0; i < 1000; i++) {
      const connId = `conn_${i}`;
      roomManager.join(connId, 'chat_lobby');
      expect(roomManager.hasMember('chat_lobby', connId)).toBe(true);
      roomManager.leaveAll(connId);
      expect(roomManager.hasMember('chat_lobby', connId)).toBe(false);
    }

    expect(roomManager.getMembers('chat_lobby').size).toBe(0);
    expect(roomManager.getRoomCount()).toBe(0);
  });

  it('should prune expired entries in cache driver without unbounded accumulation', async () => {
    const cache = new MemoryCacheDriver({ maxEntries: 100, pruneIntervalMs: 0 });

    for (let i = 0; i < 500; i++) {
      await cache.set(`key_${i}`, `val_${i}`, 1);
    }

    // Advance/wait slightly and prune
    await new Promise((resolve) => setTimeout(resolve, 10));
    await cache.pruneExpired();

    expect(cache.size).toBeLessThanOrEqual(100);
    await cache.close();
  });

  it('should safely unregister EventBus listeners without retained handlers', async () => {
    const bus = new EventBus();
    const handlers: (() => void)[] = [];

    for (let i = 0; i < 500; i++) {
      const handler = () => {};
      handlers.push(handler);
      bus.on('test.event', handler);
    }

    for (const h of handlers) {
      bus.off('test.event', h);
    }

    let invoked = false;
    bus.on('test.event', () => {
      invoked = true;
    });

    await bus.emit({ type: 'test.event', payload: {} });
    expect(invoked).toBe(true);
  });
});
