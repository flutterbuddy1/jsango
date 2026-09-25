import { describe, it, expect } from 'vitest';
import { FakeEventBus } from '../public/testing/fake.js';

describe('FakeEventBus', () => {
  it('records dispatched and emitted events', async () => {
    const fakeBus = new FakeEventBus();

    await fakeBus.emit({
      type: 'user.registered',
      payload: { id: 'u1' },
    });

    expect(fakeBus.hasDispatched('user.registered')).toBe(true);
    expect(fakeBus.hasDispatched('user.deleted')).toBe(false);

    const events = fakeBus.getDispatched<{ id: string }>('user.registered');
    expect(events).toHaveLength(1);
    expect(events[0]?.payload.id).toBe('u1');

    fakeBus.reset();
    expect(fakeBus.dispatchedEvents).toHaveLength(0);
  });
});
