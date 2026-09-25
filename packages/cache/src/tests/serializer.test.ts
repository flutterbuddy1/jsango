import { describe, it, expect } from 'vitest';
import { SafeCacheSerializer } from '../public/serializer.js';
import { CacheSerializationError } from '../public/errors.js';

describe('SafeCacheSerializer', () => {
  const serializer = new SafeCacheSerializer();

  it('should serialize and deserialize primitives', () => {
    expect(serializer.deserialize(serializer.serialize('hello'))).toBe('hello');
    expect(serializer.deserialize(serializer.serialize(12345))).toBe(12345);
    expect(serializer.deserialize(serializer.serialize(true))).toBe(true);
    expect(serializer.deserialize(serializer.serialize(null))).toBe(null);
  });

  it('should serialize and deserialize complex plain objects and arrays', () => {
    const data = {
      user: { id: 'u1', name: 'Alice', active: true },
      tags: ['admin', 'staff'],
      count: 42,
    };

    const deserialized = serializer.deserialize<typeof data>(serializer.serialize(data));
    expect(deserialized).toEqual(data);
  });

  it('should safely serialize and restore Date objects', () => {
    const now = new Date();
    const serialized = serializer.serialize({ timestamp: now });
    const deserialized = serializer.deserialize<{ timestamp: Date }>(serialized);

    expect(deserialized.timestamp).toBeInstanceOf(Date);
    expect(deserialized.timestamp.getTime()).toBe(now.getTime());
  });

  it('should safely serialize and restore BigInt values', () => {
    const big = BigInt('9007199254740991999999');
    const serialized = serializer.serialize({ val: big });
    const deserialized = serializer.deserialize<{ val: bigint }>(serialized);

    expect(typeof deserialized.val).toBe('bigint');
    expect(deserialized.val).toBe(big);
  });

  it('should reject serializing undefined values', () => {
    expect(() => serializer.serialize(undefined)).toThrow(CacheSerializationError);
  });

  it('should reject executable functions and closures', () => {
    const fnObj = {
      name: 'attacker',
      run: () => console.log('pwned'),
    };

    expect(() => serializer.serialize(fnObj)).toThrow(CacheSerializationError);
  });

  it('should sanitize prototype pollution attempts (__proto__, constructor)', () => {
    const malicious = '{"__proto__":{"polluted":true},"normal":"safe"}';
    const parsed = serializer.deserialize<Record<string, unknown>>(malicious);

    expect(parsed['normal']).toBe('safe');
    expect(({} as unknown as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('should reject payloads exceeding maxValueBytes', () => {
    const boundedSerializer = new SafeCacheSerializer({ maxValueBytes: 20 });
    const bigPayload = { message: 'this is definitely more than twenty bytes' };

    expect(() => boundedSerializer.serialize(bigPayload)).toThrow(CacheSerializationError);
  });
});
