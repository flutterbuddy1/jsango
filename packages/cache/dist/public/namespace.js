/**
 * Logical cache namespace wrapper providing typed scoped cache operations.
 */
export class CacheNamespace {
    namespaceName;
    store;
    constructor(namespaceName, store) {
        this.namespaceName = namespaceName;
        this.store = store.namespace(namespaceName);
    }
    get name() {
        return this.store.name;
    }
    get driver() {
        return this.store.driver;
    }
    get(key) {
        return this.store.get(key);
    }
    set(key, value, options) {
        return this.store.set(key, value, options);
    }
    has(key) {
        return this.store.has(key);
    }
    delete(key) {
        return this.store.delete(key);
    }
    clear() {
        return this.store.clear();
    }
    remember(key, factory, options) {
        return this.store.remember(key, factory, options);
    }
    getOrSet(key, factory, options) {
        return this.store.getOrSet(key, factory, options);
    }
    increment(key, amount) {
        return this.store.increment(key, amount);
    }
    decrement(key, amount) {
        return this.store.decrement(key, amount);
    }
    expire(key, ttlMs) {
        return this.store.expire(key, ttlMs);
    }
    ttl(key) {
        return this.store.ttl(key);
    }
    getMany(keys) {
        return this.store.getMany(keys);
    }
    setMany(entries, options) {
        return this.store.setMany(entries, options);
    }
    deleteMany(keys) {
        return this.store.deleteMany(keys);
    }
    namespace(prefix) {
        return this.store.namespace(prefix);
    }
    getStats() {
        return this.store.getStats();
    }
    resetStats() {
        this.store.resetStats();
    }
    close() {
        return this.store.close();
    }
}
//# sourceMappingURL=namespace.js.map