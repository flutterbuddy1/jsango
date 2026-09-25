import { describe, it, expect } from 'vitest';
import { Application } from '../../packages/middleware/src/index.js';
import { HttpRequest } from '../../packages/http/src/index.js';
import { EventBus } from '../../packages/events/src/index.js';
import { DatabaseManager } from '../../packages/database/src/index.js';

describe('Performance Hardening & Concurrency Load Tests', () => {
  it('should handle 1,000 concurrent HTTP requests through application pipeline', async () => {
    const app = new Application({ isProduction: true });
    app.get('/api/users/:id<number>', (ctx) => {
      const id = Number(ctx.request.params['id']);
      return { id, status: 'active' };
    });

    const promises: Promise<unknown>[] = [];
    for (let i = 0; i < 1000; i++) {
      const req = new HttpRequest({
        method: 'GET',
        url: `http://localhost:3000/api/users/${i}`,
      });
      promises.push(app.handle(req));
    }

    const responses = (await Promise.all(promises)) as { statusCode: number }[];
    expect(responses.length).toBe(1000);
    for (const res of responses) {
      expect(res.statusCode).toBe(200);
    }
  });

  it('should handle 1,000 concurrent event dispatches', async () => {
    const bus = new EventBus();
    let handledCount = 0;

    bus.on(
      'order.created',
      () => {
        handledCount++;
      },
      { mode: 'async' }
    );

    const promises: Promise<unknown>[] = [];
    for (let i = 0; i < 1000; i++) {
      promises.push(bus.emit({ type: 'order.created', payload: { orderId: i } }));
    }

    await Promise.all(promises);
    expect(handledCount).toBe(1000);
  });

  it('should handle concurrent database queries on connection', async () => {
    const db = new DatabaseManager({
      default: 'default',
      connections: {
        default: {
          driver: 'memory',
          database: 'concurrency_test',
        },
      },
    });

    const conn = await db.connection('default');
    await conn.query('CREATE TABLE items (id INTEGER, name TEXT);');

    const insertPromises: Promise<unknown>[] = [];
    for (let i = 0; i < 100; i++) {
      insertPromises.push(
        conn.query('INSERT INTO items (id, name) VALUES (?, ?);', [i, `Item ${i}`])
      );
    }

    await Promise.all(insertPromises);

    const result = await conn.query('SELECT * FROM items;');
    expect(result.rows.length).toBe(100);

    conn.release();
    await db.close();
  });
});
