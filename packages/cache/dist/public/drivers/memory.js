import { LruCacheMap } from '../../internal/lru.js';
/**
 * High-performance In-Memory Cache Driver with LRU eviction and deterministic TTL semantics.
 */
export class MemoryCacheDriver {
    name = 'memory';
    capabilities = {
        supportsTtl: true,
        supportsIncrement: true,
        supportsMultiKey: true,
        supportsTags: false,
        maxKeyLength: 1024,
    };
    lru;
    pruneTimer;
    constructor(options = {}) {
        this.lru = new LruCacheMap({
            maxEntries: options.maxEntries,
        });
        const pruneInterval = options.pruneIntervalMs ?? 60_000;
        if (pruneInterval > 0) {
            this.pruneTimer = setInterval(() => {
                this.pruneExpired();
            }, pruneInterval);
            // Unref timer so it does not block node process exit
            if (typeof this.pruneTimer === 'object' && 'unref' in this.pruneTimer) {
                this.pruneTimer.unref();
            }
        }
    }
    get size() {
        return this.lru.size;
    }
    async get(key) {
        const node = this.lru.get(key);
        if (!node) {
            return undefined;
        }
        const now = Date.now();
        if (node.expiresAt !== undefined && now >= node.expiresAt) {
            this.lru.delete(key);
            return undefined;
        }
        return node.value;
    }
    async set(key, value, ttlMs) {
        const now = Date.now();
        // Zero or negative TTL means immediately expired -> delete if exists and do not store
        if (ttlMs !== undefined && ttlMs <= 0) {
            this.lru.delete(key);
            return;
        }
        const expiresAt = ttlMs !== undefined ? now + ttlMs : undefined;
        this.lru.set(key, value, expiresAt);
    }
    async has(key) {
        const node = this.lru.peek(key);
        if (!node) {
            return false;
        }
        const now = Date.now();
        if (node.expiresAt !== undefined && now >= node.expiresAt) {
            this.lru.delete(key);
            return false;
        }
        return true;
    }
    async delete(key) {
        return this.lru.delete(key);
    }
    async clear() {
        this.lru.clear();
    }
    async increment(key, amount = 1) {
        const node = this.lru.get(key);
        const now = Date.now();
        if (node && node.expiresAt !== undefined && now >= node.expiresAt) {
            this.lru.delete(key);
        }
        const currentNode = this.lru.get(key);
        let currentVal = 0;
        let expiresAt;
        if (currentNode) {
            const num = Number(currentNode.value);
            currentVal = Number.isFinite(num) ? num : 0;
            expiresAt = currentNode.expiresAt;
        }
        const newVal = currentVal + amount;
        this.lru.set(key, newVal, expiresAt);
        return newVal;
    }
    async decrement(key, amount = 1) {
        return this.increment(key, -amount);
    }
    async expire(key, ttlMs) {
        const node = this.lru.get(key);
        if (!node) {
            return false;
        }
        if (ttlMs <= 0) {
            this.lru.delete(key);
            return true;
        }
        node.expiresAt = Date.now() + ttlMs;
        return true;
    }
    async ttl(key) {
        const node = this.lru.peek(key);
        if (!node) {
            return undefined;
        }
        if (node.expiresAt === undefined) {
            return undefined; // No expiration
        }
        const remaining = node.expiresAt - Date.now();
        if (remaining <= 0) {
            this.lru.delete(key);
            return undefined;
        }
        return remaining;
    }
    async getMany(keys) {
        const result = new Map();
        for (const key of keys) {
            const val = await this.get(key);
            if (val !== undefined) {
                result.set(key, val);
            }
        }
        return result;
    }
    async setMany(entries, ttlMs) {
        const iterable = entries instanceof Map ? entries.entries() : entries;
        for (const [k, v] of iterable) {
            await this.set(k, v, ttlMs);
        }
    }
    async deleteMany(keys) {
        let count = 0;
        for (const k of keys) {
            if (this.lru.delete(k)) {
                count++;
            }
        }
        return count;
    }
    /**
     * Sweeps and evicts all expired keys in the cache.
     */
    pruneExpired() {
        const now = Date.now();
        let pruned = 0;
        for (const [key, node] of this.lru.entries()) {
            if (node.expiresAt !== undefined && now >= node.expiresAt) {
                this.lru.delete(key);
                pruned++;
            }
        }
        return pruned;
    }
    async close() {
        if (this.pruneTimer) {
            clearInterval(this.pruneTimer);
            this.pruneTimer = undefined;
        }
        this.lru.clear();
    }
}
//# sourceMappingURL=memory.js.map