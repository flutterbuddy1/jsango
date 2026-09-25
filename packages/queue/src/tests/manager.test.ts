import { describe, it, expect, afterEach } from 'vitest';
import { QueueManager } from '../public/manager.js';
import { QueueError } from '../public/errors.js';

describe('QueueManager', () => {
  let manager: QueueManager;

  afterEach(async () => {
    if (manager) {
      await manager.close();
    }
  });

  it('should initialize and dispatch jobs across named queues', async () => {
    manager = new QueueManager({
      default: 'default',
      connections: {
        default: { driver: 'memory' },
      },
    });

    const defaultJobId = await manager.dispatch('task.run', { data: 1 });
    expect(typeof defaultJobId).toBe('string');

    const emailJobId = await manager.dispatch('email.send', { to: 'bob' }, { queue: 'emails' });
    expect(typeof emailJobId).toBe('string');

    expect(await manager.queue('default').depth()).toBe(1);
    expect(await manager.queue('emails').depth()).toBe(1);
  });

  it('should register job definitions directly on manager', () => {
    manager = new QueueManager();
    manager.registerJob({
      type: 'test.type',
      handler: async () => {},
    });

    expect(manager.registry.has('test.type')).toBe(true);
  });

  it('should throw QueueError when accessing closed manager', async () => {
    manager = new QueueManager();
    await manager.close();

    expect(() => manager.queue()).toThrow(QueueError);
  });
});
