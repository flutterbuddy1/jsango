import { CacheConnectionError } from '../errors.js';
/**
 * Redis Cache Driver Adapter implementing ICacheDriver over an injected IRedisClient.
 */
export class RedisCacheDriver {
    name = 'redis';
    capabilities = {
        supportsTtl: true,
        supportsIncrement: true,
        supportsMultiKey: true,
        supportsTags: false,
        maxKeyLength: 512,
    };
    client;
    constructor(options) {
        this.client = options.client;
    }
    async get(key) {
        try {
            const raw = await this.client.get(key);
            if (raw === null) {
                return undefined;
            }
            return raw;
        }
        catch (err) {
            throw new CacheConnectionError(`Redis GET failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`, err);
        }
    }
    async set(key, value, ttlMs) {
        try {
            if (ttlMs !== undefined && ttlMs <= 0) {
                await this.client.del(key);
                return;
            }
            const strVal = typeof value === 'string' ? value : String(value);
            if (ttlMs !== undefined && ttlMs > 0) {
                await this.client.set(key, strVal, 'PX', ttlMs);
            }
            else {
                await this.client.set(key, strVal);
            }
        }
        catch (err) {
            throw new CacheConnectionError(`Redis SET failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`, err);
        }
    }
    async has(key) {
        try {
            const count = await this.client.exists(key);
            return count > 0;
        }
        catch (err) {
            throw new CacheConnectionError(`Redis EXISTS failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`, err);
        }
    }
    async delete(key) {
        try {
            const count = await this.client.del(key);
            return count > 0;
        }
        catch (err) {
            throw new CacheConnectionError(`Redis DEL failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`, err);
        }
    }
    async clear() {
        try {
            await this.client.flushdb();
        }
        catch (err) {
            throw new CacheConnectionError(`Redis FLUSHDB failed: ${err instanceof Error ? err.message : String(err)}`, err);
        }
    }
    async increment(key, amount = 1) {
        try {
            return await this.client.incrby(key, amount);
        }
        catch (err) {
            throw new CacheConnectionError(`Redis INCRBY failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`, err);
        }
    }
    async decrement(key, amount = 1) {
        try {
            return await this.client.decrby(key, amount);
        }
        catch (err) {
            throw new CacheConnectionError(`Redis DECRBY failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`, err);
        }
    }
    async expire(key, ttlMs) {
        try {
            if (ttlMs <= 0) {
                const deleted = await this.client.del(key);
                return deleted > 0;
            }
            const res = await this.client.pexpire(key, ttlMs);
            return res === 1;
        }
        catch (err) {
            throw new CacheConnectionError(`Redis PEXPIRE failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`, err);
        }
    }
    async ttl(key) {
        try {
            const pttl = await this.client.pttl(key);
            // Redis returns -2 if key does not exist, -1 if key exists without TTL
            if (pttl === -2) {
                return undefined;
            }
            if (pttl === -1) {
                return undefined;
            }
            return pttl;
        }
        catch (err) {
            throw new CacheConnectionError(`Redis PTTL failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`, err);
        }
    }
    async getMany(keys) {
        if (keys.length === 0) {
            return new Map();
        }
        try {
            const values = await this.client.mget(...keys);
            const result = new Map();
            for (let i = 0; i < keys.length; i++) {
                const val = values[i];
                if (val !== null && val !== undefined) {
                    result.set(keys[i], val);
                }
            }
            return result;
        }
        catch (err) {
            throw new CacheConnectionError(`Redis MGET failed: ${err instanceof Error ? err.message : String(err)}`, err);
        }
    }
    async setMany(entries, ttlMs) {
        const map = entries instanceof Map ? entries : new Map(entries);
        if (map.size === 0) {
            return;
        }
        try {
            if (ttlMs !== undefined) {
                // Redis MSET does not accept TTL; set each key individually
                for (const [k, v] of map.entries()) {
                    await this.set(k, v, ttlMs);
                }
                return;
            }
            const record = {};
            for (const [k, v] of map.entries()) {
                record[k] = typeof v === 'string' ? v : String(v);
            }
            await this.client.mset(record);
        }
        catch (err) {
            throw new CacheConnectionError(`Redis MSET failed: ${err instanceof Error ? err.message : String(err)}`, err);
        }
    }
    async deleteMany(keys) {
        if (keys.length === 0) {
            return 0;
        }
        try {
            return await this.client.del(...keys);
        }
        catch (err) {
            throw new CacheConnectionError(`Redis DEL failed: ${err instanceof Error ? err.message : String(err)}`, err);
        }
    }
    async close() {
        try {
            await this.client.quit();
        }
        catch {
            // Ignore cleanup error on shutdown
        }
    }
}
//# sourceMappingURL=redis.js.map