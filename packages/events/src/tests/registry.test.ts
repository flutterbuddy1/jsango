import { describe, it, expect } from 'vitest';
import { EventRegistry } from '../public/registry.js';
import { EventRegistrationError } from '../public/errors.js';

describe('EventRegistry', () => {
  it('registers handlers and retrieves them sorted by priority', () => {
    const registry = new EventRegistry();
    const calls: string[] = [];

    registry.register({
      type: 'user.created',
      handler: () => {
        calls.push('low');
      },
      mode: 'sync',
      priority: 10,
    });

    registry.register({
      type: 'user.created',
      handler: () => {
        calls.push('high');
      },
      mode: 'sync',
      priority: 100,
    });

    registry.register({
      type: 'user.created',
      handler: () => {
        calls.push('default');
      },
      mode: 'sync',
      // default priority is 0
    });

    const handlers = registry.getHandlers('user.created');
    expect(handlers).toHaveLength(3);
    expect(handlers[0]?.priority).toBe(100);
    expect(handlers[1]?.priority).toBe(10);
    expect(handlers[2]?.priority).toBe(0);
  });

  it('detects duplicate handler registrations by explicit id', () => {
    const registry = new EventRegistry();

    registry.register({
      id: 'unique-handler',
      type: 'order.placed',
      handler: () => {},
      mode: 'sync',
    });

    expect(() => {
      registry.register({
        id: 'unique-handler',
        type: 'order.placed',
        handler: () => {},
        mode: 'sync',
      });
    }).toThrow(EventRegistrationError);
  });

  it('unregisters handlers by id', () => {
    const registry = new EventRegistry();
    const handlerId = registry.register({
      type: 'user.deleted',
      handler: () => {},
      mode: 'sync',
    });

    expect(registry.hasHandlers('user.deleted')).toBe(true);
    const removed = registry.unregister('user.deleted', handlerId);
    expect(removed).toBe(true);
    expect(registry.hasHandlers('user.deleted')).toBe(false);
  });

  it('filters handlers by execution mode', () => {
    const registry = new EventRegistry();

    registry.register({
      type: 'item.updated',
      handler: () => {},
      mode: 'sync',
    });

    registry.register({
      type: 'item.updated',
      handler: () => {},
      mode: 'async',
    });

    registry.register({
      type: 'item.updated',
      handler: () => {},
      mode: 'queued',
      queue: 'notifications',
    });

    expect(registry.getHandlersByMode('item.updated', 'sync')).toHaveLength(1);
    expect(registry.getHandlersByMode('item.updated', 'async')).toHaveLength(1);
    expect(registry.getHandlersByMode('item.updated', 'queued')).toHaveLength(1);
  });

  it('provides inspect() for telemetry/admin diagnostics', () => {
    const registry = new EventRegistry();

    registry.register({
      type: 'payment.completed',
      handler: () => {},
      mode: 'sync',
      priority: 50,
    });

    const report = registry.inspect();
    expect(report).toHaveLength(1);
    expect(report[0]?.type).toBe('payment.completed');
    expect(report[0]?.handlers).toHaveLength(1);
    expect(report[0]?.handlers[0]?.mode).toBe('sync');
    expect(report[0]?.handlers[0]?.priority).toBe(50);
  });
});
