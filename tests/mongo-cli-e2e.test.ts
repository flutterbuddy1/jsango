/**
 * `jsango makemigrations` / `migrate` / `migrate:status` / `migrate:rollback` / `migrate:check` /
 * `db:status` against a standalone MongoDB (no replica set), exactly as a user runs them.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CliApplication, CliOutput } from '../packages/cli/dist/index.js';
import { clearDatabaseManager, defaultModelRegistry, setDatabaseManager, transaction } from '../packages/orm/dist/index.js';
import { DatabaseManager } from '../packages/database/dist/index.js';

const ROOT = path.join(__dirname, `.tmp-mongo-cli-${process.pid}`);
const APP = path.join(ROOT, 'app');
const originalCwd = process.cwd();
let mongod: MongoMemoryServer;
let url: string;

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

async function cli(...args: string[]): Promise<{ code: number; out: string }> {
  let out = '';
  const output = new CliOutput({
    color: false,
    stdout: { write: (s: string) => (out += s) },
    stderr: { write: (s: string) => (out += s) },
  });
  process.chdir(APP);
  try {
    return { code: await CliApplication.createDefault().run(args, output), out };
  } finally {
    process.chdir(originalCwd);
  }
}

describe('MongoDB through the CLI (standalone server)', () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    url = `${mongod.getUri()}jsango_cli`;
    fs.rmSync(ROOT, { recursive: true, force: true });
    clearDatabaseManager();
    defaultModelRegistry.clear();

    write(path.join(APP, 'package.json'), JSON.stringify({ name: 'mongo-app', type: 'module', dependencies: { jsango: '*' } }));
    write(path.join(APP, '.env'), `DATABASE_URL=${url}\n`);
    write(
      path.join(APP, 'jsango.config.ts'),
      `import { defineConfig, databaseConfigFromEnv } from 'jsango';
export default defineConfig({ database: databaseConfigFromEnv(), models: './src/models', migrations: './migrations' });
`
    );
    write(
      path.join(APP, 'src/models/user.ts'),
      `import { defineModel, fields } from 'jsango';
export const User = defineModel('User', {
  id: fields.objectId({ primaryKey: true }),
  email: fields.string({ maxLength: 191, unique: true }),
  name: fields.string({ maxLength: 100, nullable: true }),
}, { table: 'users', timestamps: true });
`
    );
  }, 120_000);

  afterAll(async () => {
    clearDatabaseManager();
    process.chdir(originalCwd);
    fs.rmSync(ROOT, { recursive: true, force: true });
    await mongod?.stop();
  });

  it('db:status reports the MongoDB connection', async () => {
    const { code, out } = await cli('db:status');
    expect(out).toContain('mongodb');
    expect(out).toContain('HEALTHY');
    expect(code).toBe(0);
  });

  it('makemigrations + migrate create the collection, indexes and validator', async () => {
    const gen = await cli('makemigrations');
    expect(gen.out).toContain('Created migration');
    expect(gen.code).toBe(0);

    const dry = await cli('migrate', '--dry-run');
    expect(dry.code).toBe(0);
    expect(dry.out).toContain('"op":"createCollection"');
    expect(dry.out).toContain('"name":"uq_users_email"');

    const run = await cli('migrate');
    expect(run.out).toContain('Applied 1 migration(s)');
    expect(run.code).toBe(0);

    const status = await cli('migrate:status');
    expect(status.out).toContain('Up to date');
    expect((await cli('migrate:check')).code).toBe(0);
  });

  it('models work against the migrated collection', async () => {
    const db = new DatabaseManager({ default: 'default', connections: { default: { url } } });
    setDatabaseManager(db);
    try {
      const { User } = (await import(path.join(APP, 'src/models/user.ts'))) as { User: any };
      const u = await User.create({ email: 'a@example.com', name: 'Ada' });
      expect(u.id).toMatch(/^[0-9a-f]{24}$/);
      expect((await User.find(u.id)).email).toBe('a@example.com');
      await expect(User.create({ email: 'a@example.com' })).rejects.toThrow(/duplicate/i);

      // transactions need a replica set: the error says how to enable one
      await expect(
        transaction(async () => {
          await User.create({ email: 'tx@example.com' });
        })
      ).rejects.toThrow(/replica set/);
    } finally {
      await db.close();
    }
  });

  it('a model change migrates the existing collection and rolls back', async () => {
    write(
      path.join(APP, 'src/models/user.ts'),
      fs.readFileSync(path.join(APP, 'src/models/user.ts'), 'utf8').replace(
        "name: fields.string({ maxLength: 100, nullable: true }),",
        "name: fields.string({ maxLength: 100, nullable: true }),\n  plan: fields.string({ maxLength: 20, defaultValue: 'free' }),"
      )
    );
    // The CLI imports models fresh in a new process; emulate it by pointing at a copy.
    const v2 = path.join(APP, 'src/models/user.ts');
    const copy = path.join(APP, 'src/models-v2/user.ts');
    write(copy, fs.readFileSync(v2, 'utf8'));
    write(
      path.join(APP, 'jsango.config.ts'),
      `import { defineConfig, databaseConfigFromEnv } from 'jsango';
export default defineConfig({ database: databaseConfigFromEnv(), models: './src/models-v2', migrations: './migrations' });
`
    );
    fs.renameSync(path.join(APP, 'jsango.config.ts'), path.join(APP, 'jsango.config.mts'));

    const gen = await cli('makemigrations', 'add_plan');
    expect(gen.out).toContain('Add column users.plan');
    expect(gen.code).toBe(0);

    const run = await cli('migrate');
    expect(run.out).toContain('Applied 1 migration(s)');

    const db = new DatabaseManager({ default: 'default', connections: { default: { url } } });
    try {
      const conn = await db.connection();
      try {
        // existing document was backfilled with the default
        const docs = await conn.execute!({ op: 'find', collection: 'users', filter: { email: 'a@example.com' } });
        expect(docs.rows[0]).toMatchObject({ plan: 'free' });
      } finally {
        await conn.release();
      }
    } finally {
      await db.close();
    }

    const back = await cli('migrate:rollback');
    expect(back.out).toContain('Rolled back 1 migration(s)');
    const db2 = new DatabaseManager({ default: 'default', connections: { default: { url } } });
    try {
      const conn = await db2.connection();
      try {
        const docs = await conn.execute!({ op: 'find', collection: 'users', filter: { email: 'a@example.com' } });
        expect(docs.rows[0]).not.toHaveProperty('plan');
      } finally {
        await conn.release();
      }
    } finally {
      await db2.close();
    }
  });
});
