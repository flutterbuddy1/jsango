import { describe, it, expect } from 'vitest';
import { JobRegistry } from '../public/registry.js';
import { JobRegistrationError } from '../public/errors.js';

describe('JobRegistry', () => {
  it('should register and retrieve job definitions', () => {
    const registry = new JobRegistry();
    const handler = async () => {};

    registry.register({
      type: 'emails.welcome',
      handler,
    });

    expect(registry.has('emails.welcome')).toBe(true);
    const def = registry.get('emails.welcome');
    expect(def?.type).toBe('emails.welcome');
    expect(def?.handler).toBe(handler);
  });

  it('should reject duplicate job type registrations', () => {
    const registry = new JobRegistry();
    registry.register({
      type: 'reports.generate',
      handler: async () => {},
    });

    expect(() =>
      registry.register({
        type: 'reports.generate',
        handler: async () => {},
      })
    ).toThrow(JobRegistrationError);
  });

  it('should reject empty job type or non-function handler', () => {
    const registry = new JobRegistry();

    expect(() =>
      registry.register({
        type: '',
        handler: async () => {},
      })
    ).toThrow(JobRegistrationError);

    expect(() =>
      registry.register({
        type: 'valid.type',
        handler: null as any,
      })
    ).toThrow(JobRegistrationError);
  });

  it('should list all registered definitions and clear registry', () => {
    const registry = new JobRegistry();
    registry.register({ type: 'j1', handler: async () => {} });
    registry.register({ type: 'j2', handler: async () => {} });

    expect(registry.list().length).toBe(2);
    registry.clear();
    expect(registry.list().length).toBe(0);
  });
});
