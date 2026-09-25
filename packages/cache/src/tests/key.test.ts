import { describe, it, expect } from 'vitest';
import { CacheKeyBuilder } from '../public/key.js';
import { CacheKeyError } from '../public/errors.js';

describe('CacheKeyBuilder', () => {
  it('should build a simple key', () => {
    const builder = new CacheKeyBuilder();
    expect(builder.build('user:123')).toBe('user:123');
  });

  it('should combine application, environment, prefix, and namespace', () => {
    const builder = new CacheKeyBuilder({
      application: 'myapp',
      environment: 'production',
      prefix: 'v1',
      namespace: 'users',
    });

    expect(builder.build('42')).toBe('myapp:production:v1:users:42');
  });

  it('should support creating nested sub-namespaces', () => {
    const builder = new CacheKeyBuilder({
      prefix: 'app',
      namespace: 'users',
    });

    const sub = builder.withNamespace('profiles');
    expect(sub.build('user_1')).toBe('app:users:profiles:user_1');
  });

  it('should reject keys containing control characters or whitespace', () => {
    const builder = new CacheKeyBuilder();
    expect(() => builder.build('bad key with spaces')).toThrow(CacheKeyError);
    expect(() => builder.build('bad\nkey')).toThrow(CacheKeyError);
    expect(() => builder.build('bad\x00key')).toThrow(CacheKeyError);
  });

  it('should reject keys exceeding maxKeyLength', () => {
    const builder = new CacheKeyBuilder({ maxKeyLength: 10 });
    expect(() => builder.build('this_is_too_long')).toThrow(CacheKeyError);
  });

  it('should reject empty keys', () => {
    const builder = new CacheKeyBuilder();
    expect(() => builder.build('')).toThrow(CacheKeyError);
  });
});
