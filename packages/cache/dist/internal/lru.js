/**
 * High-performance, zero-dependency Doubly-Linked LRU Cache Map.
 * Provides guaranteed O(1) reads, updates, and evictions.
 */
export class LruCacheMap {
    maxEntries;
    map = new Map();
    head;
    tail;
    constructor(options = {}) {
        this.maxEntries = options.maxEntries && options.maxEntries > 0 ? options.maxEntries : 10_000;
        // Initialize dummy head and tail sentinel nodes
        this.head = {
            key: null,
            value: null,
            createdAt: 0,
            prev: null,
            next: null,
        };
        this.tail = {
            key: null,
            value: null,
            createdAt: 0,
            prev: null,
            next: null,
        };
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }
    get size() {
        return this.map.size;
    }
    get(key) {
        const node = this.map.get(key);
        if (!node) {
            return undefined;
        }
        // Move to front (most recently used)
        this.detach(node);
        this.attachHead(node);
        return node;
    }
    peek(key) {
        return this.map.get(key);
    }
    set(key, value, expiresAt) {
        const existing = this.map.get(key);
        const now = Date.now();
        if (existing) {
            existing.value = value;
            existing.expiresAt = expiresAt;
            this.detach(existing);
            this.attachHead(existing);
            return existing;
        }
        const newNode = {
            key,
            value,
            expiresAt,
            createdAt: now,
            prev: null,
            next: null,
        };
        // Evict oldest if capacity exceeded
        if (this.map.size >= this.maxEntries) {
            this.evictOldest();
        }
        this.map.set(key, newNode);
        this.attachHead(newNode);
        return newNode;
    }
    delete(key) {
        const node = this.map.get(key);
        if (!node) {
            return false;
        }
        this.detach(node);
        this.map.delete(key);
        return true;
    }
    has(key) {
        return this.map.has(key);
    }
    clear() {
        this.map.clear();
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }
    *keys() {
        let curr = this.head.next;
        while (curr && curr !== this.tail) {
            yield curr.key;
            curr = curr.next;
        }
    }
    *entries() {
        let curr = this.head.next;
        while (curr && curr !== this.tail) {
            yield [curr.key, curr];
            curr = curr.next;
        }
    }
    evictOldest() {
        const oldest = this.tail.prev;
        if (!oldest || oldest === this.head) {
            return undefined;
        }
        this.detach(oldest);
        this.map.delete(oldest.key);
        return oldest;
    }
    detach(node) {
        if (node.prev) {
            node.prev.next = node.next;
        }
        if (node.next) {
            node.next.prev = node.prev;
        }
        node.prev = null;
        node.next = null;
    }
    attachHead(node) {
        node.next = this.head.next;
        node.prev = this.head;
        if (this.head.next) {
            this.head.next.prev = node;
        }
        this.head.next = node;
    }
}
//# sourceMappingURL=lru.js.map