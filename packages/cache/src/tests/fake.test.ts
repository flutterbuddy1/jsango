import { describe, it, expect } from 'vitest';
import { FakeCacheStore } from '../public/testing/fake.js';

describe('FakeCacheStore', () => {
  it('should store and retrieve values and record calls', async () => {
    const fake = new FakeCacheStore('test-fake');

    await fake.set('user:1', { name: 'Bob' });
    const user = await fake.get<{ name: string }>('user:1');

    expect(user).toEqual({ name: 'Bob' });
    expect(fake.calls.length).toBe(2);
    expect(fake.calls[0]?.method).toBe('set');
    expect(fake.calls[1]?.method).toBe('get');

    expect(await fake.has('user:1')).toBe(true);
    await fake.delete('user:1');
    expect(await fake.has('user:1')).toBe(false);

    fake.resetStats();
    expect(fake.calls.length).toBe(0);
  });
});
