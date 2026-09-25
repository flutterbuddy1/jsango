import { describe, bench } from 'vitest';
import {
  EventBus,
  EventRegistry,
  EventSerializer,
  createEvent,
} from '../../packages/events/src/index.js';

describe('Event System Benchmarks', () => {
  const registry = new EventRegistry();
  const bus = new EventBus();
  const busWithMiddleware = new EventBus();

  busWithMiddleware.use(async (event, next) => {
    await next();
  });

  registry.register({
    type: 'bench.event',
    handler: () => {},
    mode: 'sync',
    priority: 10,
  });

  bus.on('bench.sync', () => {}, { mode: 'sync' });
  bus.on('bench.async', async () => {}, { mode: 'async' });

  busWithMiddleware.on('bench.mw', () => {}, { mode: 'sync' });

  const sampleEvent = createEvent({
    type: 'bench.event',
    payload: { id: 12345, user: 'test', tags: ['a', 'b', 'c'] },
  });

  describe('createEvent', () => {
    bench('factory creation', () => {
      createEvent({
        type: 'user.created',
        payload: { id: 1 },
      });
    });
  });

  describe('EventRegistry', () => {
    bench('lookup handlers by type', () => {
      registry.getHandlers('bench.event');
    });

    bench('lookup handlers by mode', () => {
      registry.getHandlersByMode('bench.event', 'sync');
    });
  });

  describe('EventSerializer', () => {
    const jsonStr = EventSerializer.serialize(sampleEvent);

    bench('serialize event', () => {
      EventSerializer.serialize(sampleEvent);
    });

    bench('deserialize event string', () => {
      EventSerializer.deserialize(jsonStr);
    });
  });

  describe('EventBus Dispatch', () => {
    bench('dispatch sync handler', async () => {
      await bus.emit({ type: 'bench.sync', payload: { ok: true } });
    });

    bench('dispatch async handler', async () => {
      await bus.emit({ type: 'bench.async', payload: { ok: true } });
    });

    bench('dispatch with middleware pipeline', async () => {
      await busWithMiddleware.emit({ type: 'bench.mw', payload: { ok: true } });
    });
  });
});
