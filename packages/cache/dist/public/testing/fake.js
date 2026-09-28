import { MemoryCacheDriver } from '../drivers/memory.js';
/**
 * Deterministic FakeCacheStore for unit and application testing with recorded spy calls.
 */
export class FakeCacheStore {
    name;
    driver;
    calls = [];
    storage = new Map();
    expiries = new Map();
    constructor(name = 'fake') {
        this.name = name;
        this.driver = new MemoryCacheDriver();
    }
    async get(key) {
        this.record('get', key);
        const expiry = this.expiries.get(key);
        if (expiry !== undefined && Date.now() >= expiry) {
            this.storage.delete(key);
            this.expiries.delete(key);
            return undefined;
        }
        return this.storage.get(key);
    }
    async set(key, value, options) {
        this.record('set', key, [value, options]);
        const ttlMs = options?.ttlMs ?? (options?.ttlSeconds !== undefined ? options.ttlSeconds * 1000 : undefined);
        if (ttlMs !== undefined && ttlMs <= 0) {
            this.storage.delete(key);
            this.expiries.delete(key);
            return;
        }
        this.storage.set(key, value);
        if (ttlMs !== undefined) {
            this.expiries.set(key, Date.now() + ttlMs);
        }
        else {
            this.expiries.delete(key);
        }
    }
    async has(key) {
        this.record('has', key);
        const val = await this.get(key);
        return val !== undefined;
    }
    async delete(key) {
        this.record('delete', key);
        const existed = this.storage.has(key);
        this.storage.delete(key);
        this.expiries.delete(key);
        return existed;
    }
    async clear() {
        this.record('clear', '*');
        this.storage.clear();
        this.expiries.clear();
    }
    async remember(key, factory, options) {
        this.record('remember', key);
        const existing = await this.get(key);
        if (existing !== undefined) {
            return existing;
        }
        const fresh = await factory();
        await this.set(key, fresh, options);
        return fresh;
    }
    async getOrSet(key, factory, options) {
        return this.remember(key, factory, options);
    }
    async increment(key, amount = 1) {
        this.record('increment', key, [amount]);
        const current = Number(this.storage.get(key) ?? 0);
        const updated = current + amount;
        this.storage.set(key, updated);
        return updated;
    }
    async decrement(key, amount = 1) {
        return this.increment(key, -amount);
    }
    async expire(key, ttlMs) {
        this.record('expire', key, [ttlMs]);
        if (!this.storage.has(key))
            return false;
        if (ttlMs <= 0) {
            this.storage.delete(key);
            this.expiries.delete(key);
            return true;
        }
        this.expiries.set(key, Date.now() + ttlMs);
        return true;
    }
    async ttl(key) {
        this.record('ttl', key);
        const exp = this.expiries.get(key);
        if (exp === undefined)
            return undefined;
        const remaining = exp - Date.now();
        return remaining > 0 ? remaining : undefined;
    }
    async getMany(keys) {
        this.record('getMany', keys.join(','));
        const res = new Map();
        for (const k of keys) {
            const v = await this.get(k);
            if (v !== undefined)
                res.set(k, v);
        }
        return res;
    }
    async setMany(entries, options) {
        const iter = entries instanceof Map ? entries.entries() : entries;
        for (const [k, v] of iter) {
            await this.set(k, v, options);
        }
    }
    async deleteMany(keys) {
        let count = 0;
        for (const k of keys) {
            if (await this.delete(k))
                count++;
        }
        return count;
    }
    namespace(prefix) {
        return new FakeCacheStore(`${this.name}:${prefix}`);
    }
    getStats() {
        return {
            hits: 0,
            misses: 0,
            sets: this.calls.filter((c) => c.method === 'set').length,
            deletes: this.calls.filter((c) => c.method === 'delete').length,
            errors: 0,
            entryCount: this.storage.size,
        };
    }
    resetStats() {
        this.calls.length = 0;
    }
    async close() {
        this.storage.clear();
        this.expiries.clear();
    }
    record(method, key, args) {
        this.calls.push({
            method,
            key,
            args,
            timestamp: Date.now(),
        });
    }
}
//# sourceMappingURL=fake.js.map