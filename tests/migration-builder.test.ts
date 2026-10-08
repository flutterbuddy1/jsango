/**
 * Hand-written migrations using the ctx schema builder, as documented in docs/database/README.md.
 */
import { describe, expect, it } from 'vitest';
import { DatabaseManager } from '../packages/database/dist/index.js';
import {
  defineMigration,
  MigrationRegistry,
  MigrationRunner,
  SchemaState,
} from '../packages/migrations/dist/index.js';

describe('hand-written migrations (SQLite)', () => {
  it('runs the documented example, is replayable, and rolls back', async () => {
    const db = new DatabaseManager({
      default: 'default',
      connections: { default: { driver: 'sqlite', filename: ':memory:' } },
    });
    const registry = new MigrationRegistry();

    registry.register(
      defineMigration({
        id: '20260930110000_create_users',
        async up(ctx) {
          await ctx.createTable('users', (t) => {
            t.id();
            t.string('email').unique();
            t.string('name', 120).nullable();
            t.string('role', 20).nullable();
            t.timestamps();
          });
        },
        async down(ctx) {
          await ctx.dropTable('users');
        },
      })
    );
    registry.register(
      defineMigration({
        id: '20260930120000_rename_user_name',
        async up(ctx) {
          await ctx.renameColumn('users', 'name', 'fullName');
          await ctx.createTable('audit_logs', (t) => {
            t.id();
            t.integer('userId').references('users');
            t.string('action', 50).index();
            t.json('payload').nullable();
            t.timestamps();
          });
          await ctx.sql("UPDATE users SET role = 'member' WHERE role IS NULL");
        },
        async down(ctx) {
          await ctx.dropTable('audit_logs');
          await ctx.renameColumn('users', 'fullName', 'name');
        },
      })
    );

    const runner = new MigrationRunner({ databaseManager: db, registry });
    await db.query(
      'CREATE TABLE IF NOT EXISTS seed_marker (x INTEGER)' // unrelated table must survive
    );

    await runner.migrate();
    await db.query(
      "INSERT INTO users (email, fullName, createdAt, updatedAt) VALUES ('a@x.io', 'Ada', 'now', 'now')"
    );
    const role = await db.query<{ role: string | null }>('SELECT role FROM users');
    expect(role.rows[0]?.role).toBeNull(); // data migration ran before this insert

    await db.query(
      "INSERT INTO audit_logs (userId, action, createdAt, updatedAt) VALUES (1, 'login', 'now', 'now')"
    );
    await expect(
      db.query(
        "INSERT INTO audit_logs (userId, action, createdAt, updatedAt) VALUES (99, 'x', 'now', 'now')"
      )
    ).rejects.toThrow(/FOREIGN KEY/i);
    await expect(
      db.query("INSERT INTO users (email, createdAt, updatedAt) VALUES ('a@x.io', 'now', 'now')")
    ).rejects.toThrow(/UNIQUE/i);

    const indexes = await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index'"
    );
    expect(indexes.rows.map((r) => r.name)).toEqual(
      expect.arrayContaining(['uq_users_email', 'idx_audit_logs_action'])
    );

    // makemigrations can reconstruct the schema from these hand-written migrations
    const state = await SchemaState.fromMigrations(registry.getAllMigrations());
    expect(state.getTable('users')?.columns.map((c) => c.name)).toContain('fullName');
    expect(state.getTable('audit_logs')?.foreignKeys?.[0]?.referencedTable).toBe('users');

    // dry-run plan of nothing pending
    expect(await runner.plan()).toEqual([]);

    const back = await runner.rollback({ steps: 1 });
    expect(back.rolledBack).toEqual(['20260930120000_rename_user_name']);
    const cols = await db.query<{ name: string }>('PRAGMA table_info("users")');
    expect(cols.rows.map((c) => c.name)).toContain('name');
    const tables = await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table'"
    );
    expect(tables.rows.map((r) => r.name)).not.toContain('audit_logs');
    expect(tables.rows.map((r) => r.name)).toContain('seed_marker');

    await db.close();
  });
});
