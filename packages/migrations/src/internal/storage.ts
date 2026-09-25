import type { IDatabaseConnection, IDatabaseTransaction } from '@jsango/database';
import type { MigrationRecord } from '../public/types.js';
import type { Migration } from '../public/migration.js';

export type DatabaseExecutor = IDatabaseConnection | IDatabaseTransaction;

export class MigrationStorage {
  public static readonly TABLE_NAME = 'jsango_migrations';

  public static async ensureTable(connection: DatabaseExecutor): Promise<void> {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS "${MigrationStorage.TABLE_NAME}" (
        "id" VARCHAR(255) PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "applied_at" VARCHAR(64) NOT NULL,
        "batch" INTEGER NOT NULL,
        "checksum" VARCHAR(64)
      )
    `);
  }

  public static async getAppliedMigrations(
    connection: DatabaseExecutor
  ): Promise<readonly MigrationRecord[]> {
    await MigrationStorage.ensureTable(connection);

    const result = await connection.query<Record<string, unknown>>(`
      SELECT "id", "name", "applied_at", "batch", "checksum"
      FROM "${MigrationStorage.TABLE_NAME}"
      ORDER BY "id" ASC
    `);

    const records: MigrationRecord[] = result.rows.map((row) => ({
      id: String(row['id']),
      name: String(row['name']),
      appliedAt: new Date(String(row['applied_at'])),
      batch: Number(row['batch']),
      checksum: row['checksum'] ? String(row['checksum']) : undefined,
    }));

    return Object.freeze(records);
  }

  public static async recordMigration(
    connection: DatabaseExecutor,
    migration: Migration,
    batch: number,
    checksum?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    await connection.query(
      `
      INSERT INTO "${MigrationStorage.TABLE_NAME}" ("id", "name", "applied_at", "batch", "checksum")
      VALUES (?, ?, ?, ?, ?)
    `,
      [migration.id, migration.name, now, batch, checksum ?? null]
    );
  }

  public static async removeMigration(connection: DatabaseExecutor, id: string): Promise<void> {
    await connection.query(
      `
      DELETE FROM "${MigrationStorage.TABLE_NAME}" WHERE "id" = ?
    `,
      [id]
    );
  }

  public static async getMaxBatch(connection: DatabaseExecutor): Promise<number> {
    await MigrationStorage.ensureTable(connection);
    const result = await connection.query<Record<string, unknown>>(`
      SELECT MAX("batch") as "max_batch" FROM "${MigrationStorage.TABLE_NAME}"
    `);
    const val = result.rows[0]?.['max_batch'] ?? result.rows[0]?.['MAX("BATCH")'];
    return val !== null && val !== undefined ? Number(val) : 0;
  }
}
