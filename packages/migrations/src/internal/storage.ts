import type { IDatabaseConnection, IDatabaseTransaction } from '@jsango/database';
import type { MigrationRecord } from '../public/types.js';
import type { Migration } from '../public/migration.js';
import { adaptIdentifierQuotes, isMongoExecutor } from './quoting.js';

export type DatabaseExecutor = IDatabaseConnection | IDatabaseTransaction;

export class MigrationStorage {
  public static readonly TABLE_NAME = 'jsango_migrations';

  private static sql(connection: DatabaseExecutor, sql: string): string {
    return adaptIdentifierQuotes(connection, sql);
  }

  public static async ensureTable(connection: DatabaseExecutor): Promise<void> {
    if (isMongoExecutor(connection)) {
      // Collections are created on first insert; nothing to prepare.
      return;
    }
    await connection.query(
      MigrationStorage.sql(
        connection,
        `CREATE TABLE IF NOT EXISTS "${MigrationStorage.TABLE_NAME}" (
          "id" VARCHAR(255) PRIMARY KEY,
          "name" VARCHAR(255) NOT NULL,
          "applied_at" VARCHAR(64) NOT NULL,
          "batch" INTEGER NOT NULL,
          "checksum" VARCHAR(64)
        )`
      )
    );
  }

  public static async getAppliedMigrations(
    connection: DatabaseExecutor
  ): Promise<readonly MigrationRecord[]> {
    await MigrationStorage.ensureTable(connection);

    if (isMongoExecutor(connection)) {
      const res = await connection.execute!<Record<string, unknown>>({
        op: 'find',
        collection: MigrationStorage.TABLE_NAME,
        sort: { _id: 1 },
      });
      return Object.freeze(
        res.rows.map((row) => ({
          id: String(row['_id']),
          name: String(row['name']),
          appliedAt: new Date(String(row['applied_at'])),
          batch: Number(row['batch']),
          checksum: row['checksum'] ? String(row['checksum']) : undefined,
        }))
      );
    }

    const result = await connection.query<Record<string, unknown>>(
      MigrationStorage.sql(
        connection,
        `SELECT "id", "name", "applied_at", "batch", "checksum"
         FROM "${MigrationStorage.TABLE_NAME}"
         ORDER BY "id" ASC`
      )
    );

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
    if (isMongoExecutor(connection)) {
      await connection.execute!({
        op: 'insertOne',
        collection: MigrationStorage.TABLE_NAME,
        document: { _id: migration.id, name: migration.name, applied_at: now, batch, checksum: checksum ?? null },
      });
      return;
    }
    await connection.query(
      MigrationStorage.sql(
        connection,
        `INSERT INTO "${MigrationStorage.TABLE_NAME}" ("id", "name", "applied_at", "batch", "checksum")
         VALUES (?, ?, ?, ?, ?)`
      ),
      [migration.id, migration.name, now, batch, checksum ?? null]
    );
  }

  public static async removeMigration(connection: DatabaseExecutor, id: string): Promise<void> {
    if (isMongoExecutor(connection)) {
      await connection.execute!({ op: 'deleteOne', collection: MigrationStorage.TABLE_NAME, filter: { _id: id } });
      return;
    }
    await connection.query(
      MigrationStorage.sql(connection, `DELETE FROM "${MigrationStorage.TABLE_NAME}" WHERE "id" = ?`),
      [id]
    );
  }

  public static async getMaxBatch(connection: DatabaseExecutor): Promise<number> {
    await MigrationStorage.ensureTable(connection);
    if (isMongoExecutor(connection)) {
      const res = await connection.execute!<{ max: unknown }>({
        op: 'aggregate',
        collection: MigrationStorage.TABLE_NAME,
        pipeline: [{ $group: { _id: null, max: { $max: '$batch' } } }],
      });
      const max = res.rows[0]?.max;
      return max === null || max === undefined ? 0 : Number(max);
    }
    const result = await connection.query<Record<string, unknown>>(
      MigrationStorage.sql(
        connection,
        `SELECT MAX("batch") AS "max_batch" FROM "${MigrationStorage.TABLE_NAME}"`
      )
    );
    const row = result.rows[0] ?? {};
    const val = row['max_batch'] ?? Object.values(row)[0];
    return val !== null && val !== undefined ? Number(val) : 0;
  }
}
