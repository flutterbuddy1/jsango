import { describe, it, expect } from 'vitest';
import { QueueMiddlewarePipeline } from '../public/middleware.js';
import { QueueError } from '../public/errors.js';
import type { JobContext } from '../public/types.js';
import { NoopLogger } from '@django-js/core';
import { DEFAULT_RETRY_POLICY } from '../public/retry.js';

describe('QueueMiddlewarePipeline', () => {
  function createDummyContext(): JobContext {
    return {
      job: {
        id: '1',
        type: 'test',
        queue: 'default',
        payload: {},
        schemaVersion: 1,
        status: 'processing',
        priority: 5,
        attempt: 1,
        maxAttempts: 3,
        timeoutMs: 30000,
        retryPolicy: DEFAULT_RETRY_POLICY,
        createdAt: Date.now(),
        scheduledAt: Date.now(),
      },
      payload: {},
      signal: new AbortController().signal,
      attempt: 1,
      logger: new NoopLogger(),
    };
  }

  it('should execute middleware in onion order', async () => {
    const pipeline = new QueueMiddlewarePipeline();
    const order: string[] = [];

    pipeline.use(async (_ctx, next) => {
      order.push('mw1:before');
      await next();
      order.push('mw1:after');
    });

    pipeline.use(async (_ctx, next) => {
      order.push('mw2:before');
      await next();
      order.push('mw2:after');
    });

    await pipeline.execute(createDummyContext(), async () => {
      order.push('terminal');
    });

    expect(order).toEqual(['mw1:before', 'mw2:before', 'terminal', 'mw2:after', 'mw1:after']);
  });

  it('should prevent calling next() multiple times', async () => {
    const pipeline = new QueueMiddlewarePipeline();

    pipeline.use(async (_ctx, next) => {
      await next();
      await next(); // Illegal second call
    });

    await expect(pipeline.execute(createDummyContext(), async () => {})).rejects.toThrow(
      QueueError
    );
  });
});
