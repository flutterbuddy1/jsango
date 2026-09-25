import { describe, it, expect } from 'vitest';
import { FakeQueue } from '../public/testing/fake.js';

describe('FakeQueue Testing Utilities', () => {
  it('should record dispatched jobs and assert successfully', async () => {
    const queue = new FakeQueue('test');

    await queue.dispatch('user.signup', { email: 'user@example.com' });

    queue.assertDispatched('user.signup');
    queue.assertDispatched('user.signup', (p: any) => p.email === 'user@example.com');
    queue.assertNotDispatched('other.job');
    queue.assertCount(1);

    expect(() => queue.assertDispatched('missing.job')).toThrow(
      'Expected job of type "missing.job" to be dispatched, but none was found.'
    );

    queue.reset();
    queue.assertCount(0);
  });
});
