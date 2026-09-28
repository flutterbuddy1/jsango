export class MigrationStorage {
    static TABLE_NAME = 'jsango_migrations';
    static async ensureTable(connection) {
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
    static async getAppliedMigrations(connection) {
        await MigrationStorage.ensureTable(connection);
        const result = await connection.query(`
      SELECT "id", "name", "applied_at", "batch", "checksum"
      FROM "${MigrationStorage.TABLE_NAME}"
      ORDER BY "id" ASC
    `);
        const records = result.rows.map((row) => ({
            id: String(row['id']),
            name: String(row['name']),
            appliedAt: new Date(String(row['applied_at'])),
            batch: Number(row['batch']),
            checksum: row['checksum'] ? String(row['checksum']) : undefined,
        }));
        return Object.freeze(records);
    }
    static async recordMigration(connection, migration, batch, checksum) {
        const now = new Date().toISOString();
        await connection.query(`
      INSERT INTO "${MigrationStorage.TABLE_NAME}" ("id", "name", "applied_at", "batch", "checksum")
      VALUES (?, ?, ?, ?, ?)
    `, [migration.id, migration.name, now, batch, checksum ?? null]);
    }
    static async removeMigration(connection, id) {
        await connection.query(`
      DELETE FROM "${MigrationStorage.TABLE_NAME}" WHERE "id" = ?
    `, [id]);
    }
    static async getMaxBatch(connection) {
        await MigrationStorage.ensureTable(connection);
        const result = await connection.query(`
      SELECT MAX("batch") as "max_batch" FROM "${MigrationStorage.TABLE_NAME}"
    `);
        const val = result.rows[0]?.['max_batch'] ?? result.rows[0]?.['MAX("BATCH")'];
        return val !== null && val !== undefined ? Number(val) : 0;
    }
}
//# sourceMappingURL=storage.js.map