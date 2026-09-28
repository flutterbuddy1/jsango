import type { LlmMessage, MemoryStore } from '../types.js';

export class InMemoryMemoryStore implements MemoryStore {
  private readonly store = new Map<string, LlmMessage[]>();
  private readonly maxMessages: number;

  constructor(maxMessages = 50) {
    this.maxMessages = maxMessages;
  }

  public async get(key: string): Promise<LlmMessage[]> {
    const list = this.store.get(key) ?? [];
    return [...list];
  }

  public async set(key: string, messages: LlmMessage[]): Promise<void> {
    const trimmed = messages.slice(-this.maxMessages);
    this.store.set(key, trimmed);
  }

  public async clear(key: string): Promise<void> {
    this.store.delete(key);
  }

  public async search(query: string, limit = 5): Promise<string[]> {
    const results: string[] = [];
    const qLower = query.toLowerCase();

    for (const msgs of this.store.values()) {
      for (const m of msgs) {
        if (m.content.toLowerCase().includes(qLower)) {
          results.push(m.content);
          if (results.length >= limit) return results;
        }
      }
    }

    return results;
  }
}

export interface DatabaseMemoryOptions {
  tableName?: string | undefined;
  connection?: any | undefined;
}

export class DatabaseMemoryStore implements MemoryStore {
  private inMemoryFallback = new InMemoryMemoryStore();
  private readonly connection?: any | undefined;

  constructor(options: DatabaseMemoryOptions = {}) {
    this.connection = options.connection;
  }

  public async get(key: string): Promise<LlmMessage[]> {
    if (this.connection && typeof this.connection.query === 'function') {
      try {
        const res = await this.connection.query('SELECT messages FROM ai_memory WHERE key = $1', [key]);
        if (res.rows?.[0]?.messages) {
          return JSON.parse(res.rows[0].messages);
        }
      } catch {
        // Fallback
      }
    }
    return this.inMemoryFallback.get(key);
  }

  public async set(key: string, messages: LlmMessage[]): Promise<void> {
    if (this.connection && typeof this.connection.query === 'function') {
      try {
        const payload = JSON.stringify(messages);
        await this.connection.query(
          'INSERT INTO ai_memory (key, messages, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET messages = $2, updated_at = NOW()',
          [key, payload]
        );
        return;
      } catch {
        // Fallback
      }
    }
    await this.inMemoryFallback.set(key, messages);
  }

  public async clear(key: string): Promise<void> {
    if (this.connection && typeof this.connection.query === 'function') {
      try {
        await this.connection.query('DELETE FROM ai_memory WHERE key = $1', [key]);
        return;
      } catch {
        // Fallback
      }
    }
    await this.inMemoryFallback.clear(key);
  }
}

export function memory(type: 'memory' | 'database' | 'cache' = 'memory'): MemoryStore {
  if (type === 'database') {
    return new DatabaseMemoryStore();
  }
  return new InMemoryMemoryStore();
}
