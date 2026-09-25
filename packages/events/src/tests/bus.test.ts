import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../public/bus.js';
import { createEvent } from '../public/event.js';
import { EventHandlerError, EventDispatchError } from '../public/errors.js';
import type { IEventQueueAdapter, EventDefinition } from '../public/types.js';

describe('EventBus', () => {
  it('dispatches sync handlers sequentially in priority order', async () => {
    const bus = new EventBus();
    const executionOrder: string[] = [];

    bus.on(
      'user.signup',
      () => {
        executionOrder.push('low-priority');
      },
      { priority: 1 }
    );

    bus.on(
      'user.signup',
      () => {
        executionOrder.push('high-priority');
      },
      { priority: 100 }
    );

    await bus.emit({
      type: 'user.signup',
      payload: { userId: '123' },
    });

    expect(executionOrder).toEqual(['high-priority', 'low-priority']);
  });

  it('dispatches async handlers concurrently', async () => {
    const bus = new EventBus();
    const results: string[] = [];

    bus.on(
      'ping',
      async () => {
        await new Promise((r) => setTimeout(r, 10));
        results.push('async1');
      },
      { mode: 'async' }
    );

    bus.on(
      'ping',
      async () => {
        results.push('async2');
      },
      { mode: 'async' }
    );

    await bus.emit({ type: 'ping', payload: {} });

    expect(results).toContain('async1');
    expect(results).toContain('async2');
  });

  it('forwards queued handlers to the configured queue adapter', async () => {
    const dispatchedToQueue: Array<{ event: EventDefinition; queue?: string }> = [];
    const mockAdapter: IEventQueueAdapter = {
      dispatch: async (event, queue) => {
        dispatchedToQueue.push({ event, queue });
      },
    };

    const bus = new EventBus({ queueAdapter: mockAdapter });

    bus.on('send.email', () => {}, { mode: 'queued', queue: 'mailer' });

    await bus.emit({
      type: 'send.email',
      payload: { to: 'user@example.com' },
    });

    expect(dispatchedToQueue).toHaveLength(1);
    expect(dispatchedToQueue[0]?.event.type).toBe('send.email');
    expect(dispatchedToQueue[0]?.queue).toBe('mailer');
  });

  it('triggers lifecycle hooks during dispatch execution', async () => {
    const onDispatched = vi.fn();
    const onHandlerStarted = vi.fn();
    const onHandlerCompleted = vi.fn();
    const onHandlerFailed = vi.fn();

    const bus = new EventBus({
      hooks: {
        onDispatched,
        onHandlerStarted,
        onHandlerCompleted,
        onHandlerFailed,
      },
    });

    bus.on('test.event', () => {}, { id: 'success-handler' });
    bus.on(
      'test.event',
      () => {
        throw new Error('boom');
      },
      { id: 'fail-handler' }
    );

    await bus.emit({ type: 'test.event', payload: {} });

    expect(onDispatched).toHaveBeenCalledTimes(1);
    expect(onHandlerStarted).toHaveBeenCalledTimes(2);
    expect(onHandlerCompleted).toHaveBeenCalledTimes(1);
    expect(onHandlerFailed).toHaveBeenCalledTimes(1);
  });

  it('handles throwOnHandlerError option when dispatching', async () => {
    const bus = new EventBus();

    bus.on('faulty.event', () => {
      throw new Error('Handler crashed');
    });

    await expect(
      bus.emit({ type: 'faulty.event', payload: {} }, { throwOnHandlerError: true })
    ).rejects.toThrow(EventDispatchError);
  });

  it('rejects dispatching when closed', async () => {
    const bus = new EventBus();
    bus.close();

    const event = createEvent({ type: 'closed.test', payload: {} });
    await expect(bus.dispatch(event)).rejects.toThrow(EventHandlerError);
  });
});
