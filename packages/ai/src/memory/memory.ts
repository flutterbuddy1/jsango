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

/**
 * Anything with jsango DatabaseManager's shape: `query()` for SQL databases, plus
 * `connection()` / `getDriverName()` so MongoDB can be used too.
 */
export interface MemoryDatabase {
  query(
    sql: string,
    params?: readonly unknown[]
  ): Promise<{ rows: readonly Record<string, unknown>[]; rowCount: number }>;
  getDriverName?(name?: string): string;
  connection?(name?: string): Promise<{
    execute?(
      command: Record<string, unknown>
    ): Promise<{ rows: readonly Record<string, unknown>[]; rowCount: number }>;
    release(): Promise<void>;
  }>;
}

export interface DatabaseMemoryOptions {
  /** The application's DatabaseManager (e.g. `db` from src/database.ts). */
  connection: MemoryDatabase;
  /** Table / collection name. Default: `ai_memory`. */
  tableName?: string | undefined;
  /** Messages kept per conversation (oldest dropped first). Default: 100. */
  maxMessages?: number | undefined;
}

/**
 * Persists conversation history in the application's database (PostgreSQL, MySQL, SQLite or
 * MongoDB). The table is created on first use.
 */
export class DatabaseMemoryStore implements MemoryStore {
  private readonly db: MemoryDatabase;
  private readonly table: string;
  private readonly maxMessages: number;
  private ready: Promise<void> | undefined;

  constructor(options: DatabaseMemoryOptions) {
    if (!options?.connection || typeof options.connection.query !== 'function') {
      throw new Error(
        'DatabaseMemoryStore requires your DatabaseManager: new DatabaseMemoryStore({ connection: db }).'
      );
    }
    if (options.tableName !== undefined && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(options.tableName)) {
      throw new Error(`Invalid memory table name '${options.tableName}'.`);
    }
    this.db = options.connection;
    this.table = options.tableName ?? 'ai_memory';
    this.maxMessages = options.maxMessages ?? 100;
  }

  private get driver(): string {
    return this.db.getDriverName?.() ?? 'sql';
  }

  private async mongo<T>(
    fn: (
      execute: NonNullable<
        Awaited<ReturnType<NonNullable<MemoryDatabase['connection']>>>['execute']
      >
    ) => Promise<T>
  ): Promise<T> {
    const conn = await this.db.connection!();
    try {
      return await fn(conn.execute!.bind(conn));
    } finally {
      await conn.release();
    }
  }

  private q(name: string): string {
    return this.driver === 'mysql' ? `\`${name}\`` : `"${name}"`;
  }

  private ensureTable(): Promise<void> {
    if (this.driver === 'mongodb') return Promise.resolve();
    this.ready ??= this.db
      .query(
        `CREATE TABLE IF NOT EXISTS ${this.q(this.table)} (` +
          `${this.q('memory_key')} VARCHAR(255) PRIMARY KEY, ` +
          `${this.q('messages')} ${this.driver === 'mysql' ? 'LONGTEXT' : 'TEXT'} NOT NULL, ` +
          `${this.q('updated_at')} VARCHAR(32) NOT NULL)`
      )
      .then(() => undefined)
      .catch((err: unknown) => {
        this.ready = undefined;
        throw err;
      });
    return this.ready;
  }

  public async get(key: string): Promise<LlmMessage[]> {
    if (this.driver === 'mongodb') {
      const res = await this.mongo((execute) =>
        execute({ op: 'find', collection: this.table, filter: { _id: key }, limit: 1 })
      );
      return (res.rows[0]?.['messages'] as LlmMessage[] | undefined) ?? [];
    }
    await this.ensureTable();
    const res = await this.db.query(
      `SELECT ${this.q('messages')} FROM ${this.q(this.table)} WHERE ${this.q('memory_key')} = ?`,
      [key]
    );
    const raw = res.rows[0]?.['messages'];
    return typeof raw === 'string' ? (JSON.parse(raw) as LlmMessage[]) : [];
  }

  public async set(key: string, messages: LlmMessage[]): Promise<void> {
    const kept = messages.slice(-this.maxMessages);
    const now = new Date().toISOString();
    if (this.driver === 'mongodb') {
      await this.mongo((execute) =>
        execute({
          op: 'updateOne',
          collection: this.table,
          filter: { _id: key },
          update: { $set: { messages: kept, updated_at: now } },
          upsert: true,
        })
      );
      return;
    }
    await this.ensureTable();
    const payload = JSON.stringify(kept);
    const update = () =>
      this.db.query(
        `UPDATE ${this.q(this.table)} SET ${this.q('messages')} = ?, ${this.q('updated_at')} = ? WHERE ${this.q('memory_key')} = ?`,
        [payload, now, key]
      );
    if ((await update()).rowCount > 0) return;
    try {
      await this.db.query(
        `INSERT INTO ${this.q(this.table)} (${this.q('memory_key')}, ${this.q('messages')}, ${this.q('updated_at')}) VALUES (?, ?, ?)`,
        [key, payload, now]
      );
    } catch (err) {
      // Another request inserted the same conversation first: update it instead.
      if ((await update()).rowCount === 0) throw err;
    }
  }

  public async clear(key: string): Promise<void> {
    if (this.driver === 'mongodb') {
      await this.mongo((execute) =>
        execute({ op: 'deleteOne', collection: this.table, filter: { _id: key } })
      );
      return;
    }
    await this.ensureTable();
    await this.db.query(`DELETE FROM ${this.q(this.table)} WHERE ${this.q('memory_key')} = ?`, [
      key,
    ]);
  }
}

/**
 * `memory()` -> in-process memory; `memory('database', { connection: db })` -> persisted.
 */
export function memory(type?: 'memory'): MemoryStore;
export function memory(type: 'database', options: DatabaseMemoryOptions): MemoryStore;
export function memory(
  type: 'memory' | 'database' = 'memory',
  options?: DatabaseMemoryOptions
): MemoryStore {
  if (type === 'database') {
    return new DatabaseMemoryStore(options as DatabaseMemoryOptions);
  }
  return new InMemoryMemoryStore();
}
