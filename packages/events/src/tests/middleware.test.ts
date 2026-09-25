import { describe, it, expect } from 'vitest';
import { EventMiddlewarePipeline } from '../public/middleware.js';
import { createEvent } from '../public/event.js';

describe('EventMiddlewarePipeline', () => {
  it('executes middleware in onion fashion', async () => {
    const pipeline = new EventMiddlewarePipeline();
    const order: string[] = [];

    pipeline.use(async (_event, next) => {
      order.push('m1-in');
      await next();
      order.push('m1-out');
    });

    pipeline.use(async (_event, next) => {
      order.push('m2-in');
      await next();
      order.push('m2-out');
    });

    const event = createEvent({ type: 'test.mw', payload: {} });

    await pipeline.execute(event, async () => {
      order.push('target');
    });

    expect(order).toEqual(['m1-in', 'm2-in', 'target', 'm2-out', 'm1-out']);
  });

  it('allows middleware to short-circuit execution', async () => {
    const pipeline = new EventMiddlewarePipeline();
    let targetReached = false;

    pipeline.use(async (_event, _next) => {
      // Short-circuit by not calling next()
    });

    const event = createEvent({ type: 'blocked.event', payload: {} });

    await pipeline.execute(event, async () => {
      targetReached = true;
    });

    expect(targetReached).toBe(false);
  });
});
