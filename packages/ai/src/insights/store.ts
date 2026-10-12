import type { MemoryDatabase } from '../memory/memory.js';

export type Row = Record<string, string | number | null>;
export type Table = 'runs' | 'calls' | 'turns';

/** Where insight records live. Built in: in-memory (default) and your SQL database. */
export interface InsightsStore {
  insert(table: Table, row: Row): Promise<void>;
  update(table: Table, id: string, patch: Row): Promise<void>;
  /** Rows with `timeColumn` in [since, until), newest first. */
  select(
    table: Table,
    query: { since: string; until: string; where?: Row | undefined; limit?: number | undefined }
  ): Promise<Row[]>;
  deleteBefore(table: Table, before: string): Promise<void>;
}

/** The time column of each table (ISO strings: they sort correctly as text in every database). */
export const TIME: Record<Table, string> = { runs: 'at', calls: 'started_at', turns: 'at' };

const COLUMNS: Record<Table, Record<string, 'id' | 'text' | 'int' | 'long'>> = {
  runs: {
    id: 'id',
    at: 'id',
    agent: 'id',
    provider: 'id',
    model: 'id',
    channel: 'id',
    call_id: 'id',
    user_id: 'id',
    tenant_id: 'id',
    status: 'id',
    input_tokens: 'int',
    output_tokens: 'int',
    total_tokens: 'int',
    cost_micros: 'int',
    duration_ms: 'int',
    tool_calls: 'int',
    error: 'text',
    input: 'long',
    output: 'long',
  },
  calls: {
    id: 'id',
    started_at: 'id',
    ended_at: 'id',
    agent: 'id',
    mode: 'id',
    providers: 'text',
    user_id: 'id',
    tenant_id: 'id',
    status: 'id',
    reason: 'text',
    duration_ms: 'int',
    turns: 'int',
    interruptions: 'int',
    input_tokens: 'int',
    output_tokens: 'int',
    cost_micros: 'int',
    audio_in_ms: 'int',
    audio_out_ms: 'int',
    first_audio_ms: 'int',
    transcript: 'long',
  },
  turns: {
    id: 'id',
    call_id: 'id',
    at: 'id',
    status: 'id',
    stt_ms: 'int',
    llm_ms: 'int',
    first_audio_ms: 'int',
    total_tokens: 'int',
  },
};

/** Bounded in-process store: fine for development and single-server apps; lost on restart. */
export class MemoryInsightsStore implements InsightsStore {
  private readonly tables: Record<Table, Row[]> = { runs: [], calls: [], turns: [] };

  constructor(private readonly maxRows = 10_000) {}

  public async insert(table: Table, row: Row): Promise<void> {
    const rows = this.tables[table];
    rows.push({ ...row });
    if (rows.length > this.maxRows) rows.splice(0, rows.length - this.maxRows);
  }

  public async update(table: Table, id: string, patch: Row): Promise<void> {
    const row = this.tables[table].find((r) => r['id'] === id);
    if (row) Object.assign(row, patch);
  }

  public async select(
    table: Table,
    q: { since: string; until: string; where?: Row | undefined; limit?: number | undefined }
  ): Promise<Row[]> {
    const t = TIME[table];
    const out: Row[] = [];
    const rows = this.tables[table];
    for (let i = rows.length - 1; i >= 0 && out.length < (q.limit ?? Infinity); i--) {
      const r = rows[i]!;
      const at = String(r[t]);
      if (at < q.since || at >= q.until) continue;
      if (q.where && Object.entries(q.where).some(([k, v]) => r[k] !== v)) continue;
      out.push({ ...r });
    }
    return out;
  }

  public async deleteBefore(table: Table, before: string): Promise<void> {
    const t = TIME[table];
    this.tables[table] = this.tables[table].filter((r) => String(r[t]) >= before);
  }
}

/**
 * Stores records in the app's SQL database (PostgreSQL, MySQL, SQLite). Tables
 * `<prefix>runs`, `<prefix>calls`, `<prefix>turns` are created on first use.
 */
export class SqlInsightsStore implements InsightsStore {
  private ready: Promise<void> | undefined;

  constructor(
    private readonly db: MemoryDatabase,
    private readonly prefix = 'ai_'
  ) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(prefix))
      throw new Error(`Invalid table prefix '${prefix}'.`);
    if (db.getDriverName?.() === 'mongodb') {
      throw new Error('AI insights support SQL databases (PostgreSQL, MySQL, SQLite) or memory.');
    }
  }

  private q(name: string): string {
    return this.db.getDriverName?.() === 'mysql' ? `\`${name}\`` : `"${name}"`;
  }

  private name(table: Table): string {
    return this.q(this.prefix + table);
  }

  private ensure(): Promise<void> {
    this.ready ??= (async () => {
      const mysql = this.db.getDriverName?.() === 'mysql';
      const type = {
        id: 'VARCHAR(64)',
        text: 'VARCHAR(1000)',
        int: 'BIGINT',
        long: mysql ? 'LONGTEXT' : 'TEXT',
      };
      for (const table of Object.keys(COLUMNS) as Table[]) {
        const cols = Object.entries(COLUMNS[table]).map(
          ([c, t]) => `${this.q(c)} ${type[t]}${c === 'id' ? ' PRIMARY KEY' : ''}`
        );
        await this.db.query(`CREATE TABLE IF NOT EXISTS ${this.name(table)} (${cols.join(', ')})`);
        const index = this.q(`${this.prefix}${table}_${TIME[table]}_idx`);
        await this.db
          .query(
            `CREATE INDEX ${mysql ? '' : 'IF NOT EXISTS '}${index} ON ${this.name(table)} (${this.q(TIME[table])})`
          )
          .catch(() => undefined); // MySQL has no IF NOT EXISTS: the index already exists
      }
    })().catch((err: unknown) => {
      this.ready = undefined;
      throw err;
    });
    return this.ready;
  }

  public async insert(table: Table, row: Row): Promise<void> {
    await this.ensure();
    const cols = Object.keys(row).filter((c) => c in COLUMNS[table]);
    await this.db.query(
      `INSERT INTO ${this.name(table)} (${cols.map((c) => this.q(c)).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      cols.map((c) => row[c] ?? null)
    );
  }

  public async update(table: Table, id: string, patch: Row): Promise<void> {
    await this.ensure();
    const cols = Object.keys(patch).filter((c) => c in COLUMNS[table] && c !== 'id');
    if (cols.length === 0) return;
    await this.db.query(
      `UPDATE ${this.name(table)} SET ${cols.map((c) => `${this.q(c)} = ?`).join(', ')} WHERE ${this.q('id')} = ?`,
      [...cols.map((c) => patch[c] ?? null), id]
    );
  }

  public async select(
    table: Table,
    q: { since: string; until: string; where?: Row | undefined; limit?: number | undefined }
  ): Promise<Row[]> {
    await this.ensure();
    const t = this.q(TIME[table]);
    const where = Object.entries(q.where ?? {}).filter(([c]) => c in COLUMNS[table]);
    const sql =
      `SELECT * FROM ${this.name(table)} WHERE ${t} >= ? AND ${t} < ?` +
      where.map(([c]) => ` AND ${this.q(c)} = ?`).join('') +
      ` ORDER BY ${t} DESC` +
      (q.limit ? ` LIMIT ${Math.max(1, Math.floor(q.limit))}` : '');
    const res = await this.db.query(sql, [q.since, q.until, ...where.map(([, v]) => v)]);
    return res.rows.map((r) => {
      const row: Row = {};
      for (const [c, kind] of Object.entries(COLUMNS[table])) {
        const v = r[c];
        // BIGINT can come back as a string (pg) or bigint: numbers for the API
        row[c] = v === null || v === undefined ? null : kind === 'int' ? Number(v) : String(v);
      }
      return row;
    });
  }

  public async deleteBefore(table: Table, before: string): Promise<void> {
    await this.ensure();
    await this.db.query(`DELETE FROM ${this.name(table)} WHERE ${this.q(TIME[table])} < ?`, [
      before,
    ]);
  }
}
