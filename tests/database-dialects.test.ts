/**
 * The same migration + ORM scenario on every SQL dialect.
 *
 * - PostgreSQL runs against pg-mem (in-process) by default.
 * - Set JSANGO_TEST_POSTGRES_URL=postgres://... and/or JSANGO_TEST_MYSQL_URL=mysql://... to run
 *   the scenario against real servers (use throwaway databases: tables are dropped).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { newDb } from 'pg-mem';
import {
  DatabaseManager,
  PostgresDatabaseDriver,
  SqlDialect,
} from '../packages/database/dist/index.js';
import {
  clearDatabaseManager,
  defineModel,
  fields,
  ModelRegistry,
  setDatabaseManager,
  transaction,
} from '../packages/orm/dist/index.js';
import {
  CreateTableOperation,
  defineMigration,
  Migration,
  MigrationRegistry,
  MigrationRunner,
  ModelSchemaConverter,
  SchemaDiffEngine,
  SchemaState,
  SqlMigrationCompiler,
  AddColumnOperation,
} from '../packages/migrations/dist/index.js';

function defineModels() {
  const registry = new ModelRegistry();
  const Author = defineModel(
    'Author',
    {
      id: fields.id(),
      email: fields.string({ maxLength: 191, unique: true }),
      active: fields.boolean({ defaultValue: true }),
      profile: fields.json({ nullable: true }),
    },
    { table: 'authors', timestamps: true, registry }
  );
  const Book = defineModel(
    'Book',
    {
      id: fields.id(),
      title: fields.string({ maxLength: 200 }),
      authorId: fields.integer(),
      price: fields.decimal({ precision: 8, scale: 2, nullable: true }),
    },
    {
      table: 'books',
      registry,
      relations: { author: { type: 'belongsTo', target: () => Author as any, foreignKey: 'authorId' } },
    }
  );
  return { registry, Author, Book };
}

/** `rollsBack` is false for pg-mem, whose pg adapter does not undo writes on ROLLBACK. */
async function scenario(db: DatabaseManager, rollsBack = true): Promise<void> {
  setDatabaseManager(db);
  const { registry, Author, Book } = defineModels();

  // Clean slate for real servers
  for (const t of ['books', 'authors', 'jsango_migrations', 'jsango_migration_lock']) {
    await db.query(`DROP TABLE IF EXISTS ${db.getDialect().quoteIdentifier(t)}`).catch(() => undefined);
  }

  // 1. Generate the initial migration from models (exactly what makemigrations does)
  const expected = ModelSchemaConverter.convert(registry.getAllModels().map((m) => m.metadata));
  const diff = SchemaDiffEngine.diff(expected, new SchemaState().toSnapshot());
  expect(diff.operations[0]).toBeInstanceOf(CreateTableOperation);
  expect((diff.operations[0] as CreateTableOperation).table.name).toBe('authors');

  const migrations = new MigrationRegistry();
  migrations.register(new Migration({ id: '20260101000000_initial', operations: diff.operations }));
  migrations.register(
    defineMigration({
      id: '20260102000000_add_pages',
      async up(ctx) {
        await ctx.addColumn('books', { name: 'pages', type: 'integer', nullable: true });
        await ctx.addIndex('books', ['title']);
      },
      async down(ctx) {
        await ctx.dropIndex('books', 'idx_books_title');
        await ctx.dropColumn('books', 'pages');
      },
    })
  );

  const runner = new MigrationRunner({ databaseManager: db, registry: migrations });
  const result = await runner.migrate();
  expect(result.applied).toEqual(['20260101000000_initial', '20260102000000_add_pages']);
  expect((await runner.status()).isUpToDate).toBe(true);

  // Replayed state knows about the hand-written migration too
  const state = await SchemaState.fromMigrations(migrations.getAllMigrations());
  expect(state.getTable('books')?.columns.map((c) => c.name)).toContain('pages');

  // 2. ORM
  const a = (await Author.create({ email: 'a@example.com', profile: { tags: ['x', 'y'] } })) as any;
  expect(a.id).toBeTruthy();
  expect(a.active).toBe(true);

  const again = (await Author.find(a.id)) as any;
  expect(again.profile).toEqual({ tags: ['x', 'y'] });
  expect(again.active).toBe(true);
  expect(again.createdAt).toBeInstanceOf(Date);

  await Book.bulkCreate([
    { title: 'One', authorId: a.id, price: 9.5 },
    { title: 'Two', authorId: a.id },
  ]);
  const books = (await Book.query().with('author').orderBy('title').get()) as any[];
  expect(books.map((b) => b.title)).toEqual(['One', 'Two']);
  expect(books[0].author.email).toBe('a@example.com');
  expect(Number(books[0].price)).toBe(9.5);
  expect(await Book.query().where('title', 'ILIKE', 'o%').count()).toBe(1);
  expect(await Book.query().offset(1).count()).toBe(2);

  await expect(Author.create({ email: 'a@example.com' })).rejects.toThrow();

  await expect(
    transaction(async () => {
      await Author.create({ email: 'rollback@example.com' });
      throw new Error('abort');
    })
  ).rejects.toThrow('abort');
  if (rollsBack) {
    expect(await Author.query().where('email', 'rollback@example.com').exists()).toBe(false);
  }

  const updated = await Book.query().where('title', 'Two').update({ price: 12 });
  expect(updated).toBe(1);

  // 3. Rollback the hand-written migration
  const back = await runner.rollback({ steps: 1 });
  expect(back.rolledBack).toEqual(['20260102000000_add_pages']);
  expect((await runner.status()).pending.map((m) => m.id)).toEqual(['20260102000000_add_pages']);
}

afterEach(() => {
  clearDatabaseManager();
});

describe('PostgreSQL (pg-mem)', () => {
  it('runs migrations and ORM operations', async () => {
    const mem = newDb({ noAstCoverageCheck: true });
    const db = new DatabaseManager({ default: 'default', connections: { default: { driver: 'postgres', database: 'app' } } });
    db.registerDriver('postgres', new PostgresDatabaseDriver({ database: 'app' }, { pg: mem.adapters.createPg() }));
    try {
      await scenario(db, false);
    } finally {
      await db.close();
    }
  });
});

const PG_URL = process.env['JSANGO_TEST_POSTGRES_URL'];
describe.skipIf(!PG_URL)('PostgreSQL (real server)', () => {
  it('runs migrations and ORM operations', async () => {
    const db = new DatabaseManager({ default: 'default', connections: { default: { url: PG_URL } } });
    try {
      await scenario(db);
    } finally {
      await db.close();
    }
  });
});

const MYSQL_URL = process.env['JSANGO_TEST_MYSQL_URL'];
describe.skipIf(!MYSQL_URL)('MySQL (real server)', () => {
  it('runs migrations and ORM operations', async () => {
    const db = new DatabaseManager({ default: 'default', connections: { default: { url: MYSQL_URL } } });
    try {
      await scenario(db);
    } finally {
      await db.close();
    }
  });
});

describe('MySQL SQL generation', () => {
  const compiler = new SqlMigrationCompiler('mysql');
  const { registry } = defineModels();
  const ops = SchemaDiffEngine.diff(
    ModelSchemaConverter.convert(registry.getAllModels().map((m) => m.metadata)),
    new SchemaState().toSnapshot()
  ).operations;

  it('uses backticks, AUTO_INCREMENT and MySQL types', () => {
    const sql = ops.flatMap((op) => compiler.compileStatements(op)).join('\n');
    expect(sql).toContain('CREATE TABLE `authors`');
    expect(sql).toContain('`id` INT AUTO_INCREMENT PRIMARY KEY');
    expect(sql).toContain('`active` TINYINT(1) NOT NULL DEFAULT 1');
    expect(sql).toContain('`profile` JSON');
    expect(sql).toContain('`createdAt` DATETIME(3) NOT NULL');
    expect(sql).toContain('CONSTRAINT `uq_authors_email` UNIQUE (`email`)');
    expect(sql).toContain('FOREIGN KEY (`authorId`) REFERENCES `authors` (`id`)');
    expect(sql).not.toContain('"');
  });

  it('compiles ALTER / DROP statements with MySQL syntax', () => {
    expect(compiler.compile(new AddColumnOperation('books', { name: 'pages', type: 'integer', nullable: true }))).toBe(
      'ALTER TABLE `books` ADD COLUMN `pages` INT;'
    );
    const dialect = new SqlDialect('question', { name: 'mysql' });
    expect(dialect.quoteIdentifier('books')).toBe('`books`');
    expect(dialect.beginTransactionStatements({ isolationLevel: 'SERIALIZABLE' })).toEqual([
      'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE',
      'START TRANSACTION',
    ]);
  });
});
