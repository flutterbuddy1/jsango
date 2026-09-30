/**
 * One ORM + migrations scenario, run unchanged on every supported database:
 *   SQLite (always), PostgreSQL via pg-mem (always), MongoDB via mongodb-memory-server (always),
 *   and real servers when JSANGO_TEST_POSTGRES_URL / JSANGO_TEST_MYSQL_URL / JSANGO_TEST_MONGO_URL
 *   are set (use throwaway databases: tables/collections are dropped).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newDb } from 'pg-mem';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { DatabaseManager, PostgresDatabaseDriver } from '../packages/database/dist/index.js';
import {
  clearDatabaseManager,
  defineModel,
  fields,
  ModelRegistry,
  setDatabaseManager,
  transaction,
} from '../packages/orm/dist/index.js';
import {
  Migration,
  MigrationRegistry,
  MigrationRunner,
  ModelSchemaConverter,
  SchemaDiffEngine,
  SchemaState,
  defineMigration,
} from '../packages/migrations/dist/index.js';

interface SuiteOptions {
  /** pg-mem does not roll back through its pg adapter. */
  readonly rollsBack: boolean;
  readonly isMongo: boolean;
  /** pg-mem does not implement HAVING. */
  readonly supportsHaving?: boolean;
}

function defineModels() {
  const registry = new ModelRegistry();
  const Author = defineModel(
    'Author',
    {
      id: fields.objectId({ primaryKey: true }),
      name: fields.string({ maxLength: 100 }),
      email: fields.string({ maxLength: 191, unique: true }),
      country: fields.string({ maxLength: 2, nullable: true }),
      active: fields.boolean({ defaultValue: true }),
      logins: fields.integer({ defaultValue: 0 }),
      profile: fields.json({ nullable: true }),
    },
    {
      table: 'q_authors',
      timestamps: true,
      registry,
      relations: { books: { type: 'hasMany', target: () => Book as any, foreignKey: 'authorId' } },
    }
  );
  const Book = defineModel(
    'Book',
    {
      id: fields.objectId({ primaryKey: true }),
      title: fields.string({ maxLength: 200 }),
      genre: fields.string({ maxLength: 20 }),
      price: fields.float(),
      pages: fields.integer({ nullable: true }),
      authorId: fields.objectId(),
      publishedAt: fields.dateTime({ nullable: true }),
    },
    {
      table: 'q_books',
      softDelete: true,
      registry,
      indexes: [{ columns: ['genre', 'price'] }],
      relations: { author: { type: 'belongsTo', target: () => Author as any, foreignKey: 'authorId' } },
    }
  );
  const Counter = defineModel('Counter', { id: fields.id(), label: fields.string() }, { table: 'q_counters', registry });
  return { registry, Author, Book, Counter };
}

async function cleanSlate(db: DatabaseManager, isMongo: boolean) {
  const names = ['q_books', 'q_authors', 'q_counters', 'jsango_migrations', 'jsango_migration_lock'];
  if (isMongo) {
    const conn = await db.connection();
    try {
      for (const collection of names) await conn.execute!({ op: 'dropCollection', collection });
    } finally {
      await conn.release();
    }
    return;
  }
  for (const t of names) {
    await db.query(`DROP TABLE IF EXISTS ${db.getDialect().quoteIdentifier(t)}`).catch(() => undefined);
  }
}

async function runSuite(db: DatabaseManager, opts: SuiteOptions): Promise<void> {
  setDatabaseManager(db);
  const { registry, Author, Book, Counter } = defineModels();
  await cleanSlate(db, opts.isMongo);

  // --- migrations generated from the models (what `jsango makemigrations` writes) -------------
  const diff = SchemaDiffEngine.diff(
    ModelSchemaConverter.convert(registry.getAllModels().map((m) => m.metadata)),
    new SchemaState().toSnapshot()
  );
  const migrations = new MigrationRegistry();
  migrations.register(new Migration({ id: '20260101000000_initial', operations: diff.operations }));
  migrations.register(
    defineMigration({
      id: '20260102000000_add_isbn',
      async up(ctx) {
        await ctx.addColumn('q_books', { name: 'isbn', type: 'string', length: 20, nullable: true });
        await ctx.addIndex('q_books', ['isbn'], { name: 'idx_q_books_isbn' });
      },
      async down(ctx) {
        await ctx.dropIndex('q_books', 'idx_q_books_isbn');
        await ctx.dropColumn('q_books', 'isbn');
      },
    })
  );
  const runner = new MigrationRunner({ databaseManager: db, registry: migrations });
  expect((await runner.plan()).length).toBe(2);
  expect((await runner.migrate()).applied).toHaveLength(2);
  expect((await runner.status()).isUpToDate).toBe(true);

  // --- create / defaults / ids / json / dates ---------------------------------------------------
  const at = (s: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, s));
  const ada = (await Author.create({ name: 'Ada', email: 'ada@example.com', country: 'GB', profile: { tags: ['math', 'code'] }, createdAt: at(1) })) as any;
  const bob = (await Author.create({ name: 'Bob', email: 'bob@example.com', country: 'US', createdAt: at(2) })) as any;
  const cy = (await Author.create({ name: 'Cy', email: 'cy@example.com', active: false, createdAt: at(3) })) as any;
  expect(ada.id).toMatch(/^[0-9a-f]{24}$/);
  expect(ada.active).toBe(true);
  expect(ada.logins).toBe(0);
  expect(ada.createdAt).toBeInstanceOf(Date);

  const fresh = (await Author.find(ada.id)) as any;
  expect(fresh.profile).toEqual({ tags: ['math', 'code'] });
  expect(fresh.active).toBe(true);
  expect(fresh.createdAt).toBeInstanceOf(Date);

  // auto-increment ids (numbers on SQL, ObjectId strings on MongoDB)
  const counter = (await Counter.create({ label: 'x' })) as any;
  expect(counter.id).toBeTruthy();
  expect(((await Counter.find(counter.id)) as any).label).toBe('x');

  await Book.bulkCreate([
    { title: 'Analytical Engines', genre: 'science', price: 30, pages: 300, authorId: ada.id, publishedAt: new Date('2020-01-01T00:00:00Z') },
    { title: 'Notes on Programs', genre: 'science', price: 12.5, pages: 120, authorId: ada.id, publishedAt: new Date('2021-06-01T00:00:00Z') },
    { title: 'Bob Builds', genre: 'kids', price: 8, pages: 40, authorId: bob.id },
    { title: 'The Big Book', genre: 'fiction', price: 25, pages: 900, authorId: bob.id, publishedAt: new Date('2019-03-01T00:00:00Z') },
    { title: 'Tiny Tales', genre: 'fiction', price: 5, authorId: cy.id },
  ]);
  expect(await Book.count()).toBe(5);

  // unique constraint enforced
  await expect(Author.create({ name: 'Dup', email: 'ada@example.com' })).rejects.toThrow();

  // --- where variants -----------------------------------------------------------------------
  const titles = async (q: { get(): Promise<readonly any[]> }) => (await q.get()).map((b: any) => b.title).sort();

  expect(await titles(Book.where('genre', 'science'))).toEqual(['Analytical Engines', 'Notes on Programs']);
  expect(await titles(Book.where('price', '>', 20))).toEqual(['Analytical Engines', 'The Big Book']);
  expect(await titles(Book.where({ genre: 'fiction', price: 5 }))).toEqual(['Tiny Tales']);
  expect(await titles(Book.whereIn('genre', ['kids', 'fiction']).whereNotIn('title', ['Tiny Tales']))).toEqual(['Bob Builds', 'The Big Book']);
  expect(await titles(Book.whereNull('pages'))).toEqual(['Tiny Tales']);
  expect(await titles(Book.query().whereNotNull('publishedAt').where('price', '<', 20))).toEqual(['Notes on Programs']);
  expect(await titles(Book.whereBetween('price', [8, 25]))).toEqual(['Bob Builds', 'Notes on Programs', 'The Big Book']);
  expect(await titles(Book.query().whereNotBetween('price', [8, 25]))).toEqual(['Analytical Engines', 'Tiny Tales']);
  expect(await titles(Book.whereLike('title', '%book%'))).toEqual(['The Big Book']); // case-insensitive
  expect(await titles(Book.whereLike('title', 'b%'))).toEqual(['Bob Builds']);
  expect(await titles(Book.whereNot('genre', 'science'))).toEqual(['Bob Builds', 'The Big Book', 'Tiny Tales']);

  // grouped conditions: genre = fiction AND (price < 10 OR pages > 500)
  expect(
    await titles(Book.where('genre', 'fiction').where((q: any) => q.where('price', '<', 10).orWhere('pages', '>', 500)))
  ).toEqual(['The Big Book', 'Tiny Tales']);
  // precedence: a AND b OR c
  expect(await titles(Book.where('genre', 'kids').where('price', 8).orWhere('title', 'Tiny Tales'))).toEqual(['Bob Builds', 'Tiny Tales']);
  expect(await titles(Book.query().whereNot((q: any) => q.where('genre', 'science').orWhere('genre', 'kids')))).toEqual(['The Big Book', 'Tiny Tales']);

  // dates compare natively
  expect(await titles(Book.where('publishedAt', '>=', new Date('2020-01-01T00:00:00Z')))).toEqual(['Analytical Engines', 'Notes on Programs']);

  // raw escape hatch per dialect
  const raw = opts.isMongo
    ? Book.whereRaw({ title: { $regex: '^Tiny' } })
    : Book.whereRaw('LOWER(title) = ?', ['tiny tales']);
  expect(await titles(raw)).toEqual(['Tiny Tales']);

  // --- ordering / paging / selection ---------------------------------------------------------
  const byPrice = (await Book.orderBy('price', 'DESC').limit(2).get()).map((b: any) => b.title);
  expect(byPrice).toEqual(['Analytical Engines', 'The Big Book']);
  expect((await Book.orderBy('price').offset(3).get()).map((b: any) => b.title)).toEqual(['The Big Book', 'Analytical Engines']);
  const page = await Book.query().orderBy('price').paginate({ page: 2, pageSize: 2 });
  expect(page.total).toBe(5);
  expect(page.totalPages).toBe(3);
  expect(page.items.map((b: any) => b.title)).toEqual(['Notes on Programs', 'The Big Book']);

  expect((await Book.orderBy('price').pluck<string>('title'))[0]).toBe('Tiny Tales');
  expect(await Book.where('genre', 'kids').value<string>('title')).toBe('Bob Builds');
  const genres = (await Book.select('genre').distinct().orderBy('genre').get()).map((b: any) => b.genre);
  expect(genres).toEqual(['fiction', 'kids', 'science']);
  expect((await Author.findMany([ada.id, bob.id])).length).toBe(2);
  expect(((await Author.latest().first()) as any).name).toBe('Cy');

  let chunks = 0;
  let seen = 0;
  await Book.query().chunk(2, (batch: readonly unknown[]) => {
    chunks++;
    seen += batch.length;
  });
  expect([chunks, seen]).toEqual([3, 5]);

  // --- aggregates --------------------------------------------------------------------------
  expect(await Book.sum('price')).toBeCloseTo(80.5);
  expect(await Book.where('genre', 'science').avg('price')).toBeCloseTo(21.25);
  expect(await Book.min('price')).toBe(5);
  expect(await Book.max('pages')).toBe(900);
  expect(await Book.where('genre', 'none').sum('price')).toBe(0);
  expect(await Book.where('genre', 'none').avg('price')).toBeNull();
  expect(await Book.count('pages')).toBe(4); // NULL pages not counted
  expect(await Book.where('genre', 'kids').exists()).toBe(true);
  expect(await Book.where('genre', 'none').doesntExist()).toBe(true);

  const grouped = await Book.query().groupBy(
    ['genre'],
    { total: ['sum', 'price'], books: ['count'], longest: ['max', 'pages'] },
    { orderBy: [['total', 'DESC']] }
  );
  expect(grouped).toEqual([
    { genre: 'science', total: 42.5, books: 2, longest: 300 },
    { genre: 'fiction', total: 30, books: 2, longest: 900 },
    { genre: 'kids', total: 8, books: 1, longest: 40 },
  ]);
  if (opts.supportsHaving !== false) {
    const popular = await Book.query().groupBy(['genre'], { books: ['count'] }, { having: [['books', '>=', 2]], orderBy: [['genre', 'ASC']] });
    expect(popular).toEqual([
      { genre: 'fiction', books: 2 },
      { genre: 'science', books: 2 },
    ]);
  }

  // --- relations ---------------------------------------------------------------------------
  const withAuthor = (await Book.where('title', 'Bob Builds').with('author').first()) as any;
  expect(withAuthor.author.name).toBe('Bob');
  const withBooks = (await Author.where('email', 'ada@example.com').with('books').first()) as any;
  expect(withBooks.books.map((b: any) => b.title).sort()).toEqual(['Analytical Engines', 'Notes on Programs']);

  // --- updates ---------------------------------------------------------------------------
  expect(await Book.where('genre', 'fiction').update({ genre: 'novel' })).toBe(2);
  expect(await Book.where('genre', 'novel').count()).toBe(2);
  expect(await Author.where('active', true).increment('logins', 2)).toBe(2);
  await ada.increment('logins');
  expect(ada.logins).toBe(1);
  expect(((await Author.find(ada.id)) as any).logins).toBe(3);
  await Author.where('email', 'bob@example.com').decrement('logins');
  expect(((await Author.find(bob.id)) as any).logins).toBe(1);

  const first = (await Author.firstOrCreate({ email: 'ada@example.com' }, { name: 'Nope' })) as any;
  expect(first.id).toBe(ada.id);
  const created = (await Author.firstOrCreate({ email: 'dee@example.com' }, { name: 'Dee' })) as any;
  expect(created.name).toBe('Dee');
  const upserted = (await Author.updateOrCreate({ email: 'dee@example.com' }, { country: 'IN' })) as any;
  expect(upserted.id).toBe(created.id);
  expect(((await Author.find(created.id)) as any).country).toBe('IN');

  const b = (await Book.where('title', 'Tiny Tales').first()) as any;
  b.pages = 64;
  await b.save();
  expect(((await Book.find(b.id)) as any).pages).toBe(64);

  // --- soft deletes ------------------------------------------------------------------------
  await b.delete();
  expect(await Book.count()).toBe(4);
  expect(await Book.onlyTrashed().count()).toBe(1);
  await Book.onlyTrashed().restore();
  expect(await Book.count()).toBe(5);
  await Book.where('genre', 'kids').delete({ force: true });
  expect(await Book.withTrashed().count()).toBe(4);

  // --- transactions ------------------------------------------------------------------------
  await expect(
    transaction(async () => {
      await Author.create({ name: 'Tx', email: 'tx@example.com' });
      await Author.where('email', 'ada@example.com').update({ country: 'FR' });
      throw new Error('abort');
    })
  ).rejects.toThrow('abort');
  if (opts.rollsBack) {
    expect(await Author.where('email', 'tx@example.com').exists()).toBe(false);
    expect(((await Author.find(ada.id)) as any).country).toBe('GB');
  }
  await transaction(async () => {
    await Author.create({ name: 'Ok', email: 'ok@example.com' });
  });
  expect(await Author.where('email', 'ok@example.com').exists()).toBe(true);

  // row locks compile everywhere (no-op on SQLite / MongoDB)
  await transaction(async () => {
    const locked = (await Author.where('email', 'ok@example.com').lockForUpdate().first()) as any;
    expect(locked.name).toBe('Ok');
  });

  // --- bulk delete & migration rollback ------------------------------------------------------
  expect(await Counter.query().delete()).toBe(1);
  expect((await runner.rollback({ steps: 1 })).rolledBack).toEqual(['20260102000000_add_isbn']);
  expect((await runner.status()).pending.map((m) => m.id)).toEqual(['20260102000000_add_isbn']);
}

afterAll(() => clearDatabaseManager());

describe('advanced queries: SQLite', () => {
  it('runs the full scenario', async () => {
    const db = new DatabaseManager({ default: 'default', connections: { default: { driver: 'sqlite', filename: ':memory:' } } });
    try {
      await runSuite(db, { rollsBack: true, isMongo: false });
    } finally {
      await db.close();
    }
  });
});

describe('advanced queries: PostgreSQL (pg-mem)', () => {
  it('runs the full scenario', async () => {
    const mem = newDb({ noAstCoverageCheck: true });
    const db = new DatabaseManager({ default: 'default', connections: { default: { driver: 'postgres' } } });
    db.registerDriver('postgres', new PostgresDatabaseDriver({}, { pg: mem.adapters.createPg() }));
    try {
      await runSuite(db, { rollsBack: false, isMongo: false, supportsHaving: false });
    } finally {
      await db.close();
    }
  });
});

describe('advanced queries: MongoDB (replica set)', () => {
  let replSet: MongoMemoryReplSet;
  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  }, 120_000);
  afterAll(async () => {
    await replSet?.stop();
  });

  it('runs the full scenario', async () => {
    const db = new DatabaseManager({
      default: 'default',
      connections: { default: { driver: 'mongodb', url: replSet.getUri(), database: 'jsango_test' } },
    });
    try {
      await runSuite(db, { rollsBack: true, isMongo: true });

      // migrations created real collections, indexes and a schema validator
      const conn = await db.connection();
      try {
        const indexes = await conn.execute!({ op: 'listIndexes', collection: 'q_authors' });
        const names = indexes.rows.map((r: any) => r.name);
        expect(names).toContain('uq_q_authors_email');
        await expect(
          conn.execute!({ op: 'insertOne', collection: 'q_authors', document: { email: 'x@example.com' } })
        ).rejects.toThrow(/Document failed validation/);
      } finally {
        await conn.release();
      }
      expect(await db.health()).toEqual([expect.objectContaining({ status: 'healthy' })]);

      // schema changes on a collection with data: add required field (backfilled), rename, drop
      const migrations = new MigrationRegistry();
      migrations.register(
        defineMigration({
          id: '20260201000000_seed_state',
          async up(ctx) {
            await ctx.createTable('m_people', (t) => {
              t.objectIdKey();
              t.string('name');
            });
          },
          async down(ctx) {
            await ctx.dropTable('m_people');
          },
        })
      );
      const runner = new MigrationRunner({ databaseManager: db, registry: migrations });
      await runner.migrate();
      const c2 = await db.connection();
      try {
        await c2.execute!({ op: 'insertMany', collection: 'm_people', documents: [{ name: 'a' }, { name: 'b' }] });
      } finally {
        await c2.release();
      }
      migrations.register(
        defineMigration({
          id: '20260202000000_evolve',
          async up(ctx) {
            await ctx.addColumn('m_people', { name: 'tier', type: 'string', nullable: false, defaultValue: 'free' });
            await ctx.renameColumn('m_people', 'name', 'fullName');
          },
          async down(ctx) {
            await ctx.renameColumn('m_people', 'fullName', 'name');
            await ctx.dropColumn('m_people', 'tier');
          },
        })
      );
      await runner.migrate();
      const c3 = await db.connection();
      try {
        const docs = await c3.execute!({ op: 'find', collection: 'm_people', sort: { fullName: 1 } });
        expect(docs.rows.map((d: any) => [d.fullName, d.tier, d.name])).toEqual([
          ['a', 'free', undefined],
          ['b', 'free', undefined],
        ]);
        await expect(c3.execute!({ op: 'insertOne', collection: 'm_people', document: { fullName: 'c' } })).rejects.toThrow(
          /failed validation/
        );
      } finally {
        await c3.release();
      }
      expect((await runner.rollback({ steps: 1 })).rolledBack).toEqual(['20260202000000_evolve']);
      const c4 = await db.connection();
      try {
        const docs = await c4.execute!({ op: 'find', collection: 'm_people', sort: { name: 1 } });
        expect(docs.rows.map((d: any) => [d.name, d.tier])).toEqual([
          ['a', undefined],
          ['b', undefined],
        ]);
        await c4.execute!({ op: 'insertOne', collection: 'm_people', document: { name: 'c' } });
      } finally {
        await c4.release();
      }
    } finally {
      await db.close();
    }
  }, 120_000);
});

const REAL: [string, string | undefined, boolean][] = [
  ['PostgreSQL (real server)', process.env['JSANGO_TEST_POSTGRES_URL'], false],
  ['MySQL (real server)', process.env['JSANGO_TEST_MYSQL_URL'], false],
  ['MongoDB (real server)', process.env['JSANGO_TEST_MONGO_URL'], true],
];
for (const [label, url, isMongo] of REAL) {
  describe.skipIf(!url)(`advanced queries: ${label}`, () => {
    it('runs the full scenario', async () => {
      const db = new DatabaseManager({ default: 'default', connections: { default: { url } } });
      try {
        await runSuite(db, { rollsBack: true, isMongo });
      } finally {
        await db.close();
      }
    }, 120_000);
  });
}
