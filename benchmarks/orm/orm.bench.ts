import { bench, describe } from 'vitest';
import {
  defineModel,
  fields,
  relations,
  setDatabaseManager,
} from '../../packages/orm/src/public/index.js';
import { SqlCompiler } from '../../packages/orm/src/internal/compiler.js';
import { Hydrator } from '../../packages/orm/src/internal/hydration.js';
import { createTestDatabase, resetTestState } from '../../packages/orm/src/tests/test-utils.js';

describe('ORM Performance Benchmarks', async () => {
  resetTestState();
  const db = createTestDatabase();
  setDatabaseManager(db.manager);

  const User = defineModel({
    name: 'User',
    table: 'users',
    fields: {
      id: fields.integer({ primaryKey: true, autoIncrement: true }),
      name: fields.string(),
      email: fields.string({ unique: true }),
      role: fields.string({ default: 'user' }),
      active: fields.boolean({ default: true }),
    },
    relations: {
      posts: relations.hasMany(() => Post, { foreignKey: 'userId' }),
    },
    timestamps: true,
  });

  const Post = defineModel({
    name: 'Post',
    table: 'posts',
    fields: {
      id: fields.integer({ primaryKey: true, autoIncrement: true }),
      userId: fields.integer(),
      title: fields.string(),
    },
    relations: {
      user: relations.belongsTo(() => User, { foreignKey: 'userId' }),
    },
  });

  // Seed sample rows
  for (let i = 1; i <= 20; i++) {
    await User.create({ name: `User ${i}`, email: `user${i}@example.com` });
    await Post.create({ userId: i, title: `Post A of User ${i}` });
    await Post.create({ userId: i, title: `Post B of User ${i}` });
  }

  const compiler = new SqlCompiler();
  const rawRow = {
    id: 1,
    name: 'Alice',
    email: 'alice@example.com',
    role: 'admin',
    active: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  // 1. Model metadata lookup
  bench('1. Model metadata lookup', () => {
    User.metadata.getField('email');
    User.metadata.getRelation('posts');
    User.metadata.fieldToColumn('email');
  });

  // 2. Model instance creation (pure memory)
  bench('2. Model instance creation', () => {
    new User({ name: 'Benchmark', email: 'bench@example.com' });
  });

  // 3. Model hydration from raw rows
  bench('3. Model hydration from raw rows', () => {
    Hydrator.hydrateModel(rawRow, User);
  });

  // 4. Query AST compilation to parameterized SQL
  bench('4. Query AST compilation', () => {
    compiler.compileSelect({
      table: 'users',
      columns: ['id', 'name', 'email'],
      where: [
        { type: 'comparison', column: 'active', operator: '=', value: true, boolean: 'AND' },
        { type: 'comparison', column: 'role', operator: '=', value: 'admin', boolean: 'AND' },
      ],
      orderBy: [{ column: 'id', direction: 'DESC' }],
      limit: 10,
    });
  });

  // 5. QueryBuilder cloning throughput
  const baseQuery = User.query().where('active', true);
  bench('5. QueryBuilder cloning throughput', () => {
    baseQuery.clone().where('role', 'admin').limit(10);
  });

  // 6. Simple SELECT query via ORM
  bench('6. Simple SELECT query via ORM', async () => {
    await User.query().where('active', true).limit(5).get();
  });

  const AuditLog = defineModel({
    name: 'AuditLog',
    table: 'audit_logs',
    fields: {
      id: fields.integer({ primaryKey: true, autoIncrement: true }),
      message: fields.string(),
    },
  });

  // 7. Bulk insert throughput
  const bulkItems = Array.from({ length: 10 }, (_, i) => ({
    message: `Log entry ${i}`,
  }));
  bench('7. Bulk insert throughput (10 items)', async () => {
    await AuditLog.bulkCreate(bulkItems);
    db.connection.tables.set('audit_logs', []);
  });

  // 8. Bulk update throughput
  bench('8. Bulk update throughput', async () => {
    await Post.query().where('userId', 1).update({ title: 'Updated Title' });
  });

  // 9. Relation eager loading throughput
  bench('9. Relation eager loading throughput (users + posts)', async () => {
    await User.query().limit(5).with('posts').get();
  });

  // 10. Pagination execution
  bench('10. Pagination execution (page 1, size 5)', async () => {
    await User.query().paginate({ page: 1, pageSize: 5 });
  });

  // 11. COUNT aggregation
  bench('11. COUNT aggregation', async () => {
    await User.query().where('active', true).count();
  });

  // 12. Transaction-backed ORM persistence
  bench('12. Transaction-backed ORM persistence', async () => {
    await db.manager.transaction(async (tx) => {
      const u = new User({ name: 'TxUser', email: 'tx@example.com' });
      await u.save({ connection: tx });
    });
  });
});
