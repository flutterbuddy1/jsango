import { CacheKeyBuilder } from './key.js';
import { SafeCacheSerializer } from './serializer.js';
import { StampedeLock } from '../internal/stampede-lock.js';
/**
 * Production CacheStore implementation.
 * Wraps an ICacheDriver with key building, safe serialization,
 * in-flight stampede defense, and lightweight stats.
 */
export class CacheStore {
    name;
    driver;
    keyBuilder;
    serializer;
    defaultTtlMs;
    stampedeLock = new StampedeLock();
    statsHits = 0;
    statsMisses = 0;
    statsSets = 0;
    statsDeletes = 0;
    statsErrors = 0;
    constructor(options) {
        this.name = options.name ?? options.driver.name;
        this.driver = options.driver;
        this.keyBuilder = options.keyBuilder ?? new CacheKeyBuilder(options.keyOptions);
        this.serializer = options.serializer ?? new SafeCacheSerializer();
        this.defaultTtlMs = options.defaultTtlMs;
    }
    get capabilities() {
        return this.driver.capabilities;
    }
    async get(key) {
        const qualifiedKey = this.keyBuilder.build(key);
        try {
            const raw = await this.driver.get(qualifiedKey);
            if (raw === undefined || raw === null) {
                this.statsMisses++;
                return undefined;
            }
            this.statsHits++;
            return this.serializer.deserialize(raw);
        }
        catch (err) {
            this.statsErrors++;
            throw err;
        }
    }
    async set(key, value, options) {
        const qualifiedKey = this.keyBuilder.build(key);
        const ttlMs = this.resolveTtlMs(options);
        try {
            const serialized = this.serializer.serialize(value);
            await this.driver.set(qualifiedKey, serialized, ttlMs);
            this.statsSets++;
        }
        catch (err) {
            this.statsErrors++;
            throw err;
        }
    }
    async has(key) {
        const qualifiedKey = this.keyBuilder.build(key);
        try {
            return await this.driver.has(qualifiedKey);
        }
        catch (err) {
            this.statsErrors++;
            throw err;
        }
    }
    async delete(key) {
        const qualifiedKey = this.keyBuilder.build(key);
        try {
            const deleted = await this.driver.delete(qualifiedKey);
            if (deleted) {
                this.statsDeletes++;
            }
            return deleted;
        }
        catch (err) {
            this.statsErrors++;
            throw err;
        }
    }
    async clear() {
        try {
            await this.driver.clear();
            this.stampedeLock.clear();
        }
        catch (err) {
            this.statsErrors++;
            throw err;
        }
    }
    async remember(key, factory, options) {
        const existing = await this.get(key);
        if (existing !== undefined) {
            return existing;
        }
        const qualifiedKey = this.keyBuilder.build(key);
        return this.stampedeLock.execute(qualifiedKey, async () => {
            // Re-check cache inside stampede lock in case another request already populated it
            const secondCheck = await this.get(key);
            if (secondCheck !== undefined) {
                return secondCheck;
            }
            const freshValue = await factory();
            await this.set(key, freshValue, options);
            return freshValue;
        });
    }
    async getOrSet(key, factory, options) {
        return this.remember(key, factory, options);
    }
    async increment(key, amount = 1) {
        const qualifiedKey = this.keyBuilder.build(key);
        try {
            return await this.driver.increment(qualifiedKey, amount);
        }
        catch (err) {
            this.statsErrors++;
            throw err;
        }
    }
    async decrement(key, amount = 1) {
        const qualifiedKey = this.keyBuilder.build(key);
        try {
            return await this.driver.decrement(qualifiedKey, amount);
        }
        catch (err) {
            this.statsErrors++;
            throw err;
        }
    }
    async expire(key, ttlMs) {
        const qualifiedKey = this.keyBuilder.build(key);
        try {
            return await this.driver.expire(qualifiedKey, ttlMs);
        }
        catch (err) {
            this.statsErrors++;
            throw err;
        }
    }
    async ttl(key) {
        const qualifiedKey = this.keyBuilder.build(key);
        try {
            return await this.driver.ttl(qualifiedKey);
        }
        catch (err) {
            this.statsErrors++;
            throw err;
        }
    }
    async getMany(keys) {
        const resultMap = new Map();
        if (keys.length === 0) {
            return resultMap;
        }
        const keyMap = new Map(); // qualifiedKey -> originalKey
        const qualifiedKeys = [];
        for (const original of keys) {
            const qualified = this.keyBuilder.build(original);
            keyMap.set(qualified, original);
            qualifiedKeys.push(qualified);
        }
        try {
            const rawMap = await this.driver.getMany(qualifiedKeys);
            for (const [qualified, raw] of rawMap.entries()) {
                const original = keyMap.get(qualified);
                if (original && raw !== undefined && raw !== null) {
                    const deserialized = this.serializer.deserialize(raw);
                    resultMap.set(original, deserialized);
                    this.statsHits++;
                }
            }
            this.statsMisses += keys.length - resultMap.size;
            return resultMap;
        }
        catch (err) {
            this.statsErrors++;
            throw err;
        }
    }
    async setMany(entries, options) {
        const entryIterable = entries instanceof Map ? entries.entries() : entries;
        const ttlMs = this.resolveTtlMs(options);
        const qualifiedEntries = [];
        for (const [k, v] of entryIterable) {
            const qualified = this.keyBuilder.build(k);
            const serialized = this.serializer.serialize(v);
            qualifiedEntries.push([qualified, serialized]);
        }
        try {
            await this.driver.setMany(qualifiedEntries, ttlMs);
            this.statsSets += qualifiedEntries.length;
        }
        catch (err) {
            this.statsErrors++;
            throw err;
        }
    }
    async deleteMany(keys) {
        if (keys.length === 0) {
            return 0;
        }
        const qualifiedKeys = keys.map((k) => this.keyBuilder.build(k));
        try {
            const count = await this.driver.deleteMany(qualifiedKeys);
            this.statsDeletes += count;
            return count;
        }
        catch (err) {
            this.statsErrors++;
            throw err;
        }
    }
    /**
     * Returns a new CacheStore scoped to a logical sub-namespace.
     */
    namespace(prefix) {
        const subKeyBuilder = this.keyBuilder.withNamespace(prefix);
        return new CacheStore({
            name: `${this.name}:${prefix}`,
            driver: this.driver,
            keyBuilder: subKeyBuilder,
            serializer: this.serializer,
            defaultTtlMs: this.defaultTtlMs,
        });
    }
    getStats() {
        let entryCount = 0;
        if ('size' in this.driver && typeof this.driver.size === 'number') {
            entryCount = this.driver.size;
        }
        return {
            hits: this.statsHits,
            misses: this.statsMisses,
            sets: this.statsSets,
            deletes: this.statsDeletes,
            errors: this.statsErrors,
            entryCount,
        };
    }
    resetStats() {
        this.statsHits = 0;
        this.statsMisses = 0;
        this.statsSets = 0;
        this.statsDeletes = 0;
        this.statsErrors = 0;
    }
    async close() {
        this.stampedeLock.clear();
        await this.driver.close();
    }
    resolveTtlMs(options) {
        if (options?.ttlMs !== undefined) {
            return options.ttlMs;
        }
        if (options?.ttlSeconds !== undefined) {
            return options.ttlSeconds * 1000;
        }
        return this.defaultTtlMs;
    }
}
//# sourceMappingURL=store.js.map