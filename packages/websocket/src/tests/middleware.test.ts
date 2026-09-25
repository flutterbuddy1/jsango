import { describe, it, expect } from 'vitest';
import { WebSocketMiddlewarePipeline } from '../public/middleware.js';
import { WebSocketContext } from '../public/context.js';
import { FakeWebSocketConnection } from '../public/testing/fake.js';

describe('WebSocketMiddlewarePipeline', () => {
  it('executes middleware handlers in onion pattern', async () => {
    const pipeline = new WebSocketMiddlewarePipeline();
    const sequence: string[] = [];

    pipeline.use(async (ctx, msg, next) => {
      sequence.push('auth-check-in');
      await next();
      sequence.push('auth-check-out');
    });

    pipeline.use(async (ctx, msg, next) => {
      sequence.push('rate-limit-in');
      await next();
      sequence.push('rate-limit-out');
    });

    const conn = new FakeWebSocketConnection();
    const ctx = new WebSocketContext({ connection: conn });

    await pipeline.execute(ctx, { type: 'chat.msg' }, async () => {
      sequence.push('handler');
    });

    expect(sequence).toEqual([
      'auth-check-in',
      'rate-limit-in',
      'handler',
      'rate-limit-out',
      'auth-check-out',
    ]);
  });
});
