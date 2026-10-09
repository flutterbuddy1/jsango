/**
 * Key-value storage for auth state: sessions, refresh-token families, revocations and
 * brute-force counters. Every entry expires.
 */
export interface AuthStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  /**
   * Atomically adds 1 (starting a new window of `ttlSeconds` when absent) and returns the current
   * count (which may already include concurrent increments).
   */
  increment(key: string, ttlSeconds: number): Promise<number>;
}

/** In-process store. Fine for development, tests and single-instance apps; lost on restart. */
export class MemoryAuthStore implements AuthStore {
  private readonly entries = new Map<string, { value: string; expiresAt: number }>();
  private writes = 0;

  /** Drops expired entries now and then, so keys that are never read again don't pile up. */
  private sweep(): void {
    if (++this.writes % 1000 !== 0) return;
    const now = Date.now();
    for (const [key, entry] of this.entries) if (entry.expiresAt <= now) this.entries.delete(key);
  }

  private live(key: string) {
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  public async get(key: string): Promise<string | undefined> {
    return this.live(key)?.value;
  }

  public async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.sweep();
    this.entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  public async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  public async increment(key: string, ttlSeconds: number): Promise<number> {
    this.sweep();
    const entry = this.live(key);
    const next = entry ? Number(entry.value) + 1 : 1;
    this.entries.set(key, {
      value: String(next),
      expiresAt: entry?.expiresAt ?? Date.now() + ttlSeconds * 1000,
    });
    return next;
  }
}

/** The subset of jsango's DatabaseManager this store needs. */
export interface AuthStoreDatabase {
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

/**
 * Stores auth state in the application database (PostgreSQL, MySQL, SQLite or MongoDB), so it
 * survives restarts and is shared by every server instance. The table / collection
 * (`jsango_auth_store` by default) is created on first use.
 */
export class DatabaseAuthStore implements AuthStore {
  private readonly db: AuthStoreDatabase;
  private readonly table: string;
  private ready: Promise<void> | undefined;

  public constructor(options: { connection: AuthStoreDatabase; tableName?: string }) {
    if (!options?.connection || typeof options.connection.query !== 'function') {
      throw new Error(
        'DatabaseAuthStore requires your DatabaseManager: new DatabaseAuthStore({ connection: db }).'
      );
    }
    if (options.tableName !== undefined && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(options.tableName)) {
      throw new Error(`Invalid auth store table name '${options.tableName}'.`);
    }
    this.db = options.connection;
    this.table = options.tableName ?? 'jsango_auth_store';
  }

  private get driver(): string {
    return this.db.getDriverName?.() ?? 'sql';
  }

  private q(name: string): string {
    return this.driver === 'mysql' ? `\`${name}\`` : `"${name}"`;
  }

  private async mongo<T>(
    fn: (
      execute: (
        command: Record<string, unknown>
      ) => Promise<{ rows: readonly Record<string, unknown>[]; rowCount: number }>
    ) => Promise<T>
  ): Promise<T> {
    const conn = await this.db.connection!();
    try {
      return await fn(conn.execute!.bind(conn));
    } finally {
      await conn.release();
    }
  }

  private ensureTable(): Promise<void> {
    this.ready ??= this.db
      .query(
        `CREATE TABLE IF NOT EXISTS ${this.q(this.table)} (` +
          `${this.q('store_key')} VARCHAR(255) PRIMARY KEY, ` +
          `${this.q('store_value')} TEXT NOT NULL, ` +
          `${this.q('counter')} BIGINT NOT NULL, ` +
          `${this.q('expires_at')} BIGINT NOT NULL)`
      )
      .then(() => undefined)
      .catch((err: unknown) => {
        this.ready = undefined;
        throw err;
      });
    return this.ready;
  }

  public async get(key: string): Promise<string | undefined> {
    const now = Date.now();
    if (this.driver === 'mongodb') {
      const res = await this.mongo((execute) =>
        execute({
          op: 'find',
          collection: this.table,
          filter: { _id: key, expires_at: { $gt: now } },
          limit: 1,
        })
      );
      const row = res.rows[0];
      return row ? String(row['store_value']) : undefined;
    }
    await this.ensureTable();
    const res = await this.db.query(
      `SELECT ${this.q('store_value')} FROM ${this.q(this.table)} WHERE ${this.q('store_key')} = ? AND ${this.q('expires_at')} > ?`,
      [key, now]
    );
    const value = res.rows[0]?.['store_value'];
    return value === undefined || value === null ? undefined : String(value);
  }

  private writes = 0;

  /** Deletes expired rows every 100 writes: keys that are never read again would pile up. */
  private sweep(): void {
    if (++this.writes % 100 !== 0) return;
    const now = Date.now();
    const done =
      this.driver === 'mongodb'
        ? this.mongo((execute) =>
            execute({
              op: 'deleteMany',
              collection: this.table,
              filter: { expires_at: { $lte: now } },
            })
          )
        : this.db.query(`DELETE FROM ${this.q(this.table)} WHERE ${this.q('expires_at')} <= ?`, [
            now,
          ]);
    void Promise.resolve(done).catch(() => {}); // best effort; retried 100 writes later
  }

  public async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.sweep();
    const expiresAt = Date.now() + ttlSeconds * 1000;
    if (this.driver === 'mongodb') {
      await this.mongo((execute) =>
        execute({
          op: 'updateOne',
          collection: this.table,
          filter: { _id: key },
          update: { $set: { store_value: value, counter: 0, expires_at: expiresAt } },
          upsert: true,
        })
      );
      return;
    }
    await this.ensureTable();
    const update = () =>
      this.db.query(
        `UPDATE ${this.q(this.table)} SET ${this.q('store_value')} = ?, ${this.q('counter')} = 0, ${this.q('expires_at')} = ? WHERE ${this.q('store_key')} = ?`,
        [value, expiresAt, key]
      );
    if ((await update()).rowCount > 0) return;
    try {
      await this.db.query(
        `INSERT INTO ${this.q(this.table)} (${this.q('store_key')}, ${this.q('store_value')}, ${this.q('counter')}, ${this.q('expires_at')}) VALUES (?, ?, 0, ?)`,
        [key, value, expiresAt]
      );
    } catch (err) {
      if ((await update()).rowCount === 0) throw err;
    }
  }

  public async delete(key: string): Promise<void> {
    if (this.driver === 'mongodb') {
      await this.mongo((execute) =>
        execute({ op: 'deleteOne', collection: this.table, filter: { _id: key } })
      );
      return;
    }
    await this.ensureTable();
    await this.db.query(`DELETE FROM ${this.q(this.table)} WHERE ${this.q('store_key')} = ?`, [
      key,
    ]);
  }

  public async increment(key: string, ttlSeconds: number): Promise<number> {
    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1000;
    if (this.driver === 'mongodb') {
      // Expired window: reset first (no-op when live or absent).
      await this.mongo((execute) =>
        execute({
          op: 'deleteOne',
          collection: this.table,
          filter: { _id: key, expires_at: { $lte: now } },
        })
      );
      const res = await this.mongo((execute) =>
        execute({
          op: 'findOneAndUpdate',
          collection: this.table,
          filter: { _id: key },
          update: {
            $inc: { counter: 1 },
            $setOnInsert: { store_value: '', expires_at: expiresAt },
          },
          upsert: true,
          returnDocument: 'after',
        })
      );
      return Number(res.rows[0]?.['counter'] ?? 1);
    }

    await this.ensureTable();
    const t = this.q(this.table);
    const [k, c, e] = [this.q('store_key'), this.q('counter'), this.q('expires_at')];
    await this.db.query(`DELETE FROM ${t} WHERE ${k} = ? AND ${e} <= ?`, [key, now]);
    // The UPDATE is atomic per row, so concurrent requests on several servers all count.
    const bump = () => this.db.query(`UPDATE ${t} SET ${c} = ${c} + 1 WHERE ${k} = ?`, [key]);
    if ((await bump()).rowCount === 0) {
      try {
        await this.db.query(
          `INSERT INTO ${t} (${k}, ${this.q('store_value')}, ${c}, ${e}) VALUES (?, '', 1, ?)`,
          [key, expiresAt]
        );
        return 1;
      } catch {
        await bump(); // another request created the row first
      }
    }
    const res = await this.db.query(`SELECT ${c} FROM ${t} WHERE ${k} = ?`, [key]);
    return Number(res.rows[0]?.['counter'] ?? 1);
  }
}
