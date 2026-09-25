import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '../query/query-client.js';

describe('QueryClient', () => {
  it('caches query results and respects staleTime', async () => {
    const queryFn = vi.fn().mockResolvedValue({ id: 1, name: 'Alice' });
    const client = new QueryClient({ defaultStaleTimeMs: 1000 });

    const first = await client.fetchQuery({
      queryKey: ['users', 1],
      queryFn,
    });
    expect(first).toEqual({ id: 1, name: 'Alice' });
    expect(queryFn).toHaveBeenCalledTimes(1);

    // Immediate second fetch should be cached
    const second = await client.fetchQuery({
      queryKey: ['users', 1],
      queryFn,
    });
    expect(second).toEqual({ id: 1, name: 'Alice' });
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent in-flight requests', async () => {
    let callCount = 0;
    const queryFn = vi.fn().mockImplementation(async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 50));
      return { count: callCount };
    });

    const client = new QueryClient();
    const [res1, res2] = await Promise.all([
      client.fetchQuery({ queryKey: ['count'], queryFn }),
      client.fetchQuery({ queryKey: ['count'], queryFn }),
    ]);

    expect(res1).toEqual({ count: 1 });
    expect(res2).toEqual({ count: 1 });
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('invalidates queries by prefix on mutation', async () => {
    const client = new QueryClient();
    client.setQueryData(['posts', 'list'], [{ id: 1 }]);
    client.setQueryData(['posts', 'detail', 1], { id: 1, title: 'Old' });
    client.setQueryData(['users', 'list'], [{ id: 10 }]);

    await client.mutate(
      {
        mutationFn: async (input: { title: string }) => ({ id: 1, title: input.title }),
        invalidateKeys: [['posts']],
      },
      { title: 'New' }
    );

    expect(client.getQueryData(['posts', 'list'])).toBeUndefined();
    expect(client.getQueryData(['posts', 'detail', 1])).toBeUndefined();
    expect(client.getQueryData(['users', 'list'])).toEqual([{ id: 10 }]);
  });
});
