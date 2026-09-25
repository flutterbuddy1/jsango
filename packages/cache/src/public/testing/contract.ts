import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ICacheDriver } from '../types.js';

export interface DriverTestContext {
  driver: ICacheDriver;
  cleanup?: () => Promise<void> | void;
}

/**
 * Universal driver contract test suite.
 * All ICacheDriver implementations must pass these tests.
 */
export function runCacheDriverContractTests(
  driverName: string,
  createDriver: () => Promise<DriverTestContext> | DriverTestContext
): void {
  describe(`ICacheDriver Contract: ${driverName}`, () => {
    let driver: ICacheDriver;
    let cleanupFn: (() => Promise<void> | void) | undefined;

    beforeEach(async () => {
      const ctx = await createDriver();
      driver = ctx.driver;
      cleanupFn = ctx.cleanup;
      await driver.clear();
    });

    afterEach(async () => {
      await driver.clear();
      await driver.close();
      if (cleanupFn) {
        await cleanupFn();
      }
    });

    it('should store and retrieve primitive values', async () => {
      await driver.set('key1', 'hello-world');
      const val = await driver.get<string>('key1');
      expect(val).toBe('hello-world');
    });

    it('should return undefined for non-existent keys', async () => {
      const val = await driver.get('non-existent');
      expect(val).toBeUndefined();
    });

    it('should correctly report key existence with has()', async () => {
      expect(await driver.has('key2')).toBe(false);
      await driver.set('key2', 'present');
      expect(await driver.has('key2')).toBe(true);
    });

    it('should delete keys successfully', async () => {
      await driver.set('to-delete', 'value');
      expect(await driver.has('to-delete')).toBe(true);
      const deleted = await driver.delete('to-delete');
      expect(deleted).toBe(true);
      expect(await driver.has('to-delete')).toBe(false);
      expect(await driver.get('to-delete')).toBeUndefined();
    });

    it('should clear all stored keys', async () => {
      await driver.set('k1', 'v1');
      await driver.set('k2', 'v2');
      await driver.clear();
      expect(await driver.get('k1')).toBeUndefined();
      expect(await driver.get('k2')).toBeUndefined();
    });

    it('should honor TTL expiration', async () => {
      await driver.set('expiring-key', 'ephemeral', 50); // 50ms TTL
      expect(await driver.get('expiring-key')).toBe('ephemeral');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 70));
      expect(await driver.get('expiring-key')).toBeUndefined();
      expect(await driver.has('expiring-key')).toBe(false);
    });

    it('should delete key immediately when TTL is zero or negative', async () => {
      await driver.set('neg-ttl', 'initial', 1000);
      expect(await driver.has('neg-ttl')).toBe(true);

      await driver.set('neg-ttl', 'zero', 0);
      expect(await driver.has('neg-ttl')).toBe(false);

      await driver.set('neg-ttl-2', 'negative', -50);
      expect(await driver.has('neg-ttl-2')).toBe(false);
    });

    it('should retrieve remaining TTL', async () => {
      await driver.set('ttl-check', 'val', 5000);
      const remaining = await driver.ttl('ttl-check');
      expect(remaining).toBeDefined();
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(5000);
    });

    it('should increment and decrement values atomically', async () => {
      const v1 = await driver.increment('counter');
      expect(v1).toBe(1);

      const v2 = await driver.increment('counter', 5);
      expect(v2).toBe(6);

      const v3 = await driver.decrement('counter', 2);
      expect(v3).toBe(4);
    });

    it('should handle multi-key getMany, setMany, deleteMany', async () => {
      await driver.setMany([
        ['m1', 'val1'],
        ['m2', 'val2'],
      ]);

      const map = await driver.getMany(['m1', 'm2', 'm3']);
      expect(map.get('m1')).toBe('val1');
      expect(map.get('m2')).toBe('val2');
      expect(map.has('m3')).toBe(false);

      const deletedCount = await driver.deleteMany(['m1', 'm2']);
      expect(deletedCount).toBe(2);
      expect(await driver.has('m1')).toBe(false);
      expect(await driver.has('m2')).toBe(false);
    });
  });
}
