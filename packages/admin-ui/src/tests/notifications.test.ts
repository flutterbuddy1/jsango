import { describe, it, expect, vi } from 'vitest';
import { ToastManager } from '../notifications/toast-context.js';

describe('ToastManager', () => {
  it('adds and dismisses toast notifications', () => {
    const manager = new ToastManager();
    const listener = vi.fn();
    manager.subscribe(listener);

    const id1 = manager.success('Operation Successful', 'Record created');
    expect(manager.getToasts()).toHaveLength(1);
    expect(manager.getToasts()[0]?.title).toBe('Operation Successful');
    expect(listener).toHaveBeenCalledTimes(1);

    const id2 = manager.error('Operation Failed');
    expect(manager.getToasts()).toHaveLength(2);

    manager.dismiss(id1);
    expect(manager.getToasts()).toHaveLength(1);
    expect(manager.getToasts()[0]?.id).toBe(id2);

    manager.clear();
    expect(manager.getToasts()).toHaveLength(0);
  });
});
