import { bench, describe } from 'vitest';
import { defineModel, fields, relations } from '../../packages/orm/src/public/index.js';
import {
  SchemaSnapshot,
  TableSchema,
  ModelSchemaConverter,
  SchemaDiffEngine,
  CreateTableOperation,
  AddColumnOperation,
  CreateIndexOperation,
  AddForeignKeyOperation,
  MigrationGenerator,
  MigrationLock,
  MigrationRegistry,
  MigrationRunner,
  Migration,
} from '../../packages/migrations/src/public/index.js';
import { SqlMigrationCompiler } from '../../packages/migrations/src/internal/compiler.js';
import {
  createTestDatabase,
  resetTestState,
} from '../../packages/migrations/src/tests/test-utils.js';

describe('Migrations Performance Benchmarks', async () => {
  resetTestState();
  const db = createTestDatabase();

  const User = defineModel({
    name: 'User',
    table: 'users',
    fields: {
      id: fields.integer({ primaryKey: true, autoIncrement: true }),
      username: fields.string({ unique: true, length: 50 }),
      email: fields.string({ unique: true, indexed: true }),
      bio: fields.text({ nullable: true }),
      active: fields.boolean({ default: true }),
    },
    timestamps: true,
    softDelete: true,
  });

  const Post = defineModel({
    name: 'Post',
    table: 'posts',
    fields: {
      id: fields.integer({ primaryKey: true, autoIncrement: true }),
      userId: fields.integer({ indexed: true }),
      title: fields.string({ length: 255 }),
      content: fields.text(),
      published: fields.boolean({ default: false }),
    },
    relations: {
      user: relations.belongsTo('User', { foreignKey: 'userId' }),
    },
    timestamps: true,
  });

  const models = [User.metadata, Post.metadata];
  const snapshotA = ModelSchemaConverter.convert(models);

  // Large schema for stress-testing diff
  const largeTablesA: TableSchema[] = [];
  const largeTablesB: TableSchema[] = [];

  for (let i = 0; i < 20; i++) {
    largeTablesA.push(
      new TableSchema({
        name: `table_${i}`,
        columns: [
          { name: 'id', type: 'integer', primaryKey: true, autoIncrement: true },
          { name: 'name', type: 'string', length: 100 },
          { name: 'created_at', type: 'dateTime' },
        ],
      })
    );

    largeTablesB.push(
      new TableSchema({
        name: `table_${i}`,
        columns: [
          { name: 'id', type: 'integer', primaryKey: true, autoIncrement: true },
          { name: 'name', type: 'string', length: 150 }, // altered
          { name: 'status', type: 'string', defaultValue: 'active' }, // added
          { name: 'created_at', type: 'dateTime' },
        ],
      })
    );
  }

  const largeSnapshotA = new SchemaSnapshot({ tables: largeTablesA });
  const largeSnapshotB = new SchemaSnapshot({ tables: largeTablesB });

  const compiler = new SqlMigrationCompiler('postgres');
  const complexOp = new CreateTableOperation({
    name: 'accounts',
    columns: [
      { name: 'id', type: 'integer', primaryKey: true, autoIncrement: true },
      { name: 'email', type: 'string', length: 255, nullable: false, unique: true },
      { name: 'balance', type: 'decimal', precision: 14, scale: 2, defaultValue: 0 },
      { name: 'metadata', type: 'json' },
    ],
    indexes: [{ name: 'idx_accounts_email', columns: ['email'], unique: true }],
  });

  const conn = await db.manager.connection('default');

  bench('1. Model to SchemaSnapshot conversion', () => {
    ModelSchemaConverter.convert(models);
  });

  bench('2. Schema diff engine (moderate schema)', () => {
    SchemaDiffEngine.diff(snapshotA, new SchemaSnapshot());
  });

  bench('3. Schema diff engine (large 20-table schema with column alterations)', () => {
    SchemaDiffEngine.diff(largeSnapshotB, largeSnapshotA);
  });

  bench('4. DDL compilation throughput', () => {
    compiler.compile(complexOp);
  });

  bench('5. Migration file generation with checksums', () => {
    MigrationGenerator.generateMigrationFile({
      name: 'add_user_posts',
      operations: [
        complexOp,
        new AddColumnOperation('users', { name: 'avatar_url', type: 'string', length: 255 }),
        new CreateIndexOperation('users', { name: 'idx_avatar', columns: ['avatar_url'] }),
        new AddForeignKeyOperation('posts', {
          name: 'fk_posts_user',
          columns: ['userId'],
          referencedTable: 'users',
          referencedColumns: ['id'],
        }),
      ],
    });
  });

  bench('6. Migration lock acquire & release', async () => {
    const lock = new MigrationLock(conn, {
      acquireTimeoutMs: 1000,
      retryIntervalMs: 10,
    });
    await lock.acquire();
    await lock.release();
  });

  bench('7. Migration runner execution (idempotent / status)', async () => {
    const reg = new MigrationRegistry();
    reg.register(
      new Migration({
        id: '20260924000000_bench_test',
        name: 'bench_test',
        operations: [],
      })
    );
    const runner = new MigrationRunner({
      databaseManager: db.manager,
      registry: reg,
    });
    await runner.status();
  });
});
