export interface LruNode<K, V> {
  key: K;
  value: V;
  expiresAt?: number | undefined;
  createdAt: number;
  prev: LruNode<K, V> | null;
  next: LruNode<K, V> | null;
}

export interface LruOptions {
  readonly maxEntries?: number | undefined;
}

/**
 * High-performance, zero-dependency Doubly-Linked LRU Cache Map.
 * Provides guaranteed O(1) reads, updates, and evictions.
 */
export class LruCacheMap<K, V> {
  public readonly maxEntries: number;
  private readonly map = new Map<K, LruNode<K, V>>();
  private readonly head: LruNode<K, V>;
  private readonly tail: LruNode<K, V>;

  constructor(options: LruOptions = {}) {
    this.maxEntries = options.maxEntries && options.maxEntries > 0 ? options.maxEntries : 10_000;

    // Initialize dummy head and tail sentinel nodes
    this.head = {
      key: null as unknown as K,
      value: null as unknown as V,
      createdAt: 0,
      prev: null,
      next: null,
    };
    this.tail = {
      key: null as unknown as K,
      value: null as unknown as V,
      createdAt: 0,
      prev: null,
      next: null,
    };
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  public get size(): number {
    return this.map.size;
  }

  public get(key: K): LruNode<K, V> | undefined {
    const node = this.map.get(key);
    if (!node) {
      return undefined;
    }

    // Move to front (most recently used)
    this.detach(node);
    this.attachHead(node);
    return node;
  }

  public peek(key: K): LruNode<K, V> | undefined {
    return this.map.get(key);
  }

  public set(key: K, value: V, expiresAt?: number): LruNode<K, V> {
    const existing = this.map.get(key);
    const now = Date.now();

    if (existing) {
      existing.value = value;
      existing.expiresAt = expiresAt;
      this.detach(existing);
      this.attachHead(existing);
      return existing;
    }

    const newNode: LruNode<K, V> = {
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

  public delete(key: K): boolean {
    const node = this.map.get(key);
    if (!node) {
      return false;
    }

    this.detach(node);
    this.map.delete(key);
    return true;
  }

  public has(key: K): boolean {
    return this.map.has(key);
  }

  public clear(): void {
    this.map.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  public *keys(): IterableIterator<K> {
    let curr = this.head.next;
    while (curr && curr !== this.tail) {
      yield curr.key;
      curr = curr.next;
    }
  }

  public *entries(): IterableIterator<[K, LruNode<K, V>]> {
    let curr = this.head.next;
    while (curr && curr !== this.tail) {
      yield [curr.key, curr];
      curr = curr.next;
    }
  }

  private evictOldest(): LruNode<K, V> | undefined {
    const oldest = this.tail.prev;
    if (!oldest || oldest === this.head) {
      return undefined;
    }

    this.detach(oldest);
    this.map.delete(oldest.key);
    return oldest;
  }

  private detach(node: LruNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    }
    node.prev = null;
    node.next = null;
  }

  private attachHead(node: LruNode<K, V>): void {
    node.next = this.head.next;
    node.prev = this.head;
    if (this.head.next) {
      this.head.next.prev = node;
    }
    this.head.next = node;
  }
}
