/**
 * End-to-end database workflow on a real SQLite file, driven through the CLI exactly as a user
 * would: jsango.config.ts -> makemigrations -> migrate -> ORM usage -> model change ->
 * makemigrations -> migrate (table rebuild) -> rollback -> check.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CliApplication, CliOutput } from '../packages/cli/dist/index.js';
import {
  clearDatabaseManager,
  defaultModelRegistry,
  setDatabaseManager,
} from '../packages/orm/dist/index.js';
import { DatabaseManager } from '../packages/database/dist/index.js';

const ROOT = path.join(__dirname, `.tmp-db-e2e-${process.pid}`);
const STAGE1 = path.join(ROOT, 'app');
const STAGE2 = path.join(ROOT, 'app-v2');
const MIGRATIONS = path.join(STAGE1, 'migrations');
const originalCwd = process.cwd();
const DB_FILE = path.join(STAGE1, 'data', 'app.sqlite3');

/** The CLI closes its own connections when a command finishes, like a separate process would. */
let appDb: DatabaseManager;
function openAppDatabase(): DatabaseManager {
  appDb = new DatabaseManager({ default: 'default', connections: { default: { driver: 'sqlite', filename: DB_FILE } } });
  setDatabaseManager(appDb);
  return appDb;
}

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

async function cli(cwd: string, ...args: string[]): Promise<{ code: number; out: string }> {
  let out = '';
  const output = new CliOutput({
    color: false,
    stdout: { write: (s: string) => (out += s) },
    stderr: { write: (s: string) => (out += s) },
  });
  process.chdir(cwd);
  try {
    const code = await CliApplication.createDefault().run(args, output);
    return { code, out };
  } finally {
    process.chdir(originalCwd);
  }
}

const USER_V1 = `import { defineModel, fields } from 'jsango';

export const User = defineModel('User', {
  id: fields.id(),
  email: fields.string({ maxLength: 255, unique: true }),
  name: fields.string({ maxLength: 50 }),
  isActive: fields.boolean({ defaultValue: true }),
  settings: fields.json({ nullable: true }),
}, { table: 'users', timestamps: true });
`;

const POST = `import { defineModel, fields } from 'jsango';

export const Post = defineModel('Post', {
  id: fields.id(),
  title: fields.string(),
  userId: fields.integer({ indexed: true }),
  publishedAt: fields.dateTime({ nullable: true }),
}, {
  table: 'posts',
  softDelete: true,
  relations: {
    author: { type: 'belongsTo', target: 'User', foreignKey: 'userId' },
  },
});
`;

// v2: new nullable column + wider name column (SQLite needs a table rebuild for the latter)
const USER_V2 = USER_V1.replace(
  "name: fields.string({ maxLength: 50 }),",
  "name: fields.string({ maxLength: 120 }),\n  age: fields.integer({ nullable: true }),"
);

describe('database workflow (SQLite, end to end)', () => {
  beforeAll(() => {
    fs.rmSync(ROOT, { recursive: true, force: true });
    clearDatabaseManager();
    defaultModelRegistry.clear();

    write(path.join(STAGE1, 'package.json'), JSON.stringify({ name: 'e2e', type: 'module', dependencies: { jsango: '*' } }));
    write(path.join(STAGE1, '.env'), 'DATABASE_URL=sqlite:./data/app.sqlite3\n');
    write(
      path.join(STAGE1, 'jsango.config.ts'),
      `import { defineConfig, databaseConfigFromEnv } from 'jsango';
export default defineConfig({ database: databaseConfigFromEnv(), models: './src/models', migrations: './migrations' });
`
    );
    write(path.join(STAGE1, 'src/models/user.ts'), USER_V1);
    write(path.join(STAGE1, 'src/models/post.ts'), POST);

    write(path.join(STAGE2, 'package.json'), JSON.stringify({ name: 'e2e2', type: 'module', dependencies: { jsango: '*' } }));
    write(
      path.join(STAGE2, 'jsango.config.ts'),
      `import { defineConfig } from 'jsango';
export default defineConfig({
  database: { default: 'primary', connections: { primary: { url: 'sqlite:../app/data/app.sqlite3' } } },
  models: ['./models/user.ts', '../app/src/models/post.ts'],
  migrations: '../app/migrations',
});
`
    );
    write(path.join(STAGE2, 'models/user.ts'), USER_V2);
  });

  afterAll(async () => {
    await appDb?.close().catch(() => undefined);
    clearDatabaseManager();
    process.chdir(originalCwd);
    fs.rmSync(ROOT, { recursive: true, force: true });
  });

  it('db:status reports the SQLite connection from .env', async () => {
    const { code, out } = await cli(STAGE1, 'db:status');
    expect(out).toContain('sqlite');
    expect(out).toContain('HEALTHY');
    expect(code).toBe(0);
  });

  it('makemigrations creates the initial migration from the models', async () => {
    const { code, out } = await cli(STAGE1, 'makemigrations');
    expect(out).toContain('Created migration');
    expect(code).toBe(0);

    const files = fs.readdirSync(MIGRATIONS);
    expect(files).toHaveLength(1);
    const content = fs.readFileSync(path.join(MIGRATIONS, files[0]!), 'utf8');
    expect(files[0]).toMatch(/^\d{14}_create_users_and_more\.ts$/);
    expect(content).toContain("from 'jsango'");
    expect(content).toContain('CreateTableOperation');
    expect(content).not.toContain('DropTableOperation');
    // users must be created before posts (posts.userId references users.id)
    expect(content.indexOf('"name": "users"')).toBeLessThan(content.indexOf('"name": "posts"'));

    const again = await cli(STAGE1, 'makemigrations');
    expect(again.out).toContain('No changes detected');
  });

  it('migrate --dry-run prints SQL without applying it', async () => {
    const { code, out } = await cli(STAGE1, 'migrate', '--dry-run');
    expect(code).toBe(0);
    expect(out).toContain('CREATE TABLE "users"');
    expect(out).toContain('"id" INTEGER PRIMARY KEY AUTOINCREMENT');
    expect(out).toContain('CREATE UNIQUE INDEX "uq_users_email"');
    expect(out).toContain('FOREIGN KEY ("userId") REFERENCES "users" ("id")');

    const status = await cli(STAGE1, 'migrate:status');
    expect(status.out).toContain('Pending migrations');
  });

  it('migrate applies the migration and status is up to date', async () => {
    const { code, out } = await cli(STAGE1, 'migrate');
    expect(out).toContain('Applied 1 migration(s)');
    expect(code).toBe(0);

    const status = await cli(STAGE1, 'migrate:status');
    expect(status.out).toContain('Up to date');

    const check = await cli(STAGE1, 'migrate:check');
    expect(check.code).toBe(0);
  });

  it('models perform real CRUD, JSON, relations, soft deletes and transactions', async () => {
    const orm = await import('../packages/orm/dist/index.js');
    openAppDatabase();
    const User = orm.defaultModelRegistry.getModel('User')!;
    const Post = orm.defaultModelRegistry.getModel('Post')!;

    const alice = (await User.create({ email: 'alice@example.com', name: 'Alice', settings: { theme: 'dark', tags: ['a'] } })) as any;
    expect(typeof alice.id).toBe('number');
    expect(alice.isActive).toBe(true);
    expect(alice.createdAt).toBeInstanceOf(Date);

    const found = (await User.find(alice.id)) as any;
    expect(found.email).toBe('alice@example.com');
    expect(found.isActive).toBe(true);
    expect(found.settings).toEqual({ theme: 'dark', tags: ['a'] });
    expect(found.createdAt).toBeInstanceOf(Date);

    // unique constraint is enforced by the database
    await expect(User.create({ email: 'alice@example.com', name: 'Dup' })).rejects.toThrow(/UNIQUE/i);

    // unknown keys (e.g. from a request body) are ignored instead of breaking the INSERT
    const bob = (await User.create({ email: 'bob@example.com', name: 'Bob', notAColumn: 1 })) as any;
    bob.name = 'Robert';
    await bob.save();
    expect(((await User.find(bob.id)) as any).name).toBe('Robert');

    await Post.bulkCreate([
      { title: 'Hello', userId: alice.id, publishedAt: new Date('2026-01-01T00:00:00Z') },
      { title: 'Second', userId: alice.id },
      { title: 'Bob post', userId: bob.id },
    ]);
    expect(await Post.count()).toBe(3);

    const posts = (await Post.query().where('userId', alice.id).with('author').orderBy('id').get()) as any[];
    expect(posts.map((p) => p.title)).toEqual(['Hello', 'Second']);
    expect(posts[0].author.email).toBe('alice@example.com');
    expect(posts[0].publishedAt).toBeInstanceOf(Date);

    const page = await Post.query().orderBy('id').paginate({ page: 2, pageSize: 2 });
    expect(page.total).toBe(3);
    expect(page.items).toHaveLength(1);
    expect(await Post.query().offset(1).count()).toBe(3);
    expect((await Post.query().orderBy('id').offset(2).get()).length).toBe(1);

    // soft delete hides the row; OR conditions cannot bypass the scope
    await posts[1].delete();
    expect(await Post.count()).toBe(2);
    expect(await Post.withTrashed().count()).toBe(3);
    expect(await Post.onlyTrashed().count()).toBe(1);
    const search = await Post.query().where('title', 'LIKE', '%Second%').orWhere('title', 'LIKE', '%Bob%').get();
    expect(search.map((p: any) => p.title)).toEqual(['Bob post']);

    // a failing transaction rolls back every model write inside it
    await expect(
      orm.transaction(async () => {
        await User.create({ email: 'carol@example.com', name: 'Carol' });
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect(await User.query().where('email', 'carol@example.com').first()).toBeNull();

    await orm.transaction(async () => {
      await User.create({ email: 'dave@example.com', name: 'Dave' });
    });
    expect(await User.query().where('email', 'dave@example.com').exists()).toBe(true);

    // deleting a user cascades to its posts (foreign keys are enforced)
    await bob.delete();
    expect(await Post.withTrashed().where('userId', bob.id).count()).toBe(0);
  });

  it('a model change produces a second migration that keeps existing data', async () => {
    const gen = await cli(STAGE2, 'makemigrations', 'user_age');
    expect(gen.out).toContain('Created migration');
    expect(gen.out).toContain('Add column users.age');
    expect(gen.out).toContain('Alter column users.name');
    expect(gen.code).toBe(0);

    const files = fs.readdirSync(MIGRATIONS).sort();
    expect(files).toHaveLength(2);
    expect(files[1]).toMatch(/_user_age\.ts$/);

    const run = await cli(STAGE2, 'migrate');
    expect(run.out).toContain('Applied 1 migration(s)');
    expect(run.code).toBe(0);

    await appDb.close();
    const db = openAppDatabase();
    const cols = await db.query<{ name: string; type: string }>('PRAGMA table_info("users")');
    expect(cols.rows.map((c) => c.name)).toContain('age');
    expect(cols.rows.find((c) => c.name === 'name')?.type).toBe('VARCHAR(120)');

    // data and constraints survived the SQLite table rebuild
    const rows = await db.query<{ email: string }>('SELECT email FROM users ORDER BY id');
    expect(rows.rows.map((r) => r.email)).toEqual(['alice@example.com', 'dave@example.com']);
    await expect(db.query("INSERT INTO users (email, name, isActive, createdAt, updatedAt) VALUES ('alice@example.com', 'x', 1, 'now', 'now')")).rejects.toThrow(/UNIQUE/i);
    const posts = await db.query('SELECT * FROM posts');
    expect(posts.rows).toHaveLength(2);

    const check = await cli(STAGE2, 'migrate:check');
    expect(check.code).toBe(0);
  });

  it('rollback reverts the last migration', async () => {
    const back = await cli(STAGE2, 'migrate:rollback');
    expect(back.out).toContain('Rolled back 1 migration(s)');
    expect(back.code).toBe(0);

    await appDb.close();
    const db = openAppDatabase();
    const cols = await db.query<{ name: string }>('PRAGMA table_info("users")');
    expect(cols.rows.map((c) => c.name)).not.toContain('age');
    const rows = await db.query('SELECT * FROM users');
    expect(rows.rows).toHaveLength(2);

    const check = await cli(STAGE2, 'migrate:check');
    expect(check.code).not.toBe(0);
    expect(check.out).toContain('not applied');
  });

  it('explains how to configure a database when none is set up', async () => {
    const empty = path.join(ROOT, 'no-db');
    write(path.join(empty, 'package.json'), JSON.stringify({ name: 'x', dependencies: { jsango: '*' } }));
    const saved = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];
    try {
      const { code, out } = await cli(empty, 'migrate');
      expect(code).not.toBe(0);
      expect(out).toContain('No database is configured');
      expect(out).toContain('jsango.config.ts');
    } finally {
      if (saved !== undefined) process.env['DATABASE_URL'] = saved;
    }
  });
});
