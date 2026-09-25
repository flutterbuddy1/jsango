import { describe, it, expect } from 'vitest';
import { SqlMigrationCompiler } from '../internal/compiler.js';
import {
  CreateTableOperation,
  DropTableOperation,
  AddColumnOperation,
  DropColumnOperation,
  CreateIndexOperation,
  DropIndexOperation,
  AddForeignKeyOperation,
  DropForeignKeyOperation,
} from '../public/operations.js';

describe('SqlMigrationCompiler', () => {
  it('should compile CreateTableOperation with proper quoting and dialect types', () => {
    const compiler = new SqlMigrationCompiler('postgres');
    const op = new CreateTableOperation({
      name: 'users',
      columns: [
        { name: 'id', type: 'integer', primaryKey: true, autoIncrement: true },
        { name: 'email', type: 'string', length: 150, nullable: false, unique: true },
        { name: 'active', type: 'boolean', defaultValue: true },
        { name: 'metadata', type: 'json' },
      ],
    });

    const sql = compiler.compile(op);
    expect(sql).toContain('CREATE TABLE "users"');
    expect(sql).toContain('"id" SERIAL PRIMARY KEY');
    expect(sql).toContain('"email" VARCHAR(150) NOT NULL');
    expect(sql).toContain('"active" BOOLEAN DEFAULT TRUE');
    expect(sql).toContain('"metadata" JSONB');
  });

  it('should compile DropTable, AddColumn, and DropColumn operations', () => {
    const compiler = new SqlMigrationCompiler('memory');

    const dropTable = compiler.compile(new DropTableOperation('users'));
    expect(dropTable).toBe('DROP TABLE "users";');

    const addCol = compiler.compile(
      new AddColumnOperation('users', { name: 'phone', type: 'string', length: 20 })
    );
    expect(addCol).toBe('ALTER TABLE "users" ADD COLUMN "phone" VARCHAR(20);');

    const dropCol = compiler.compile(new DropColumnOperation('users', 'phone'));
    expect(dropCol).toBe('ALTER TABLE "users" DROP COLUMN "phone";');
  });

  it('should compile CreateIndex and DropIndex operations', () => {
    const compiler = new SqlMigrationCompiler('memory');

    const createIdx = compiler.compile(
      new CreateIndexOperation('users', {
        name: 'idx_users_email',
        columns: ['email'],
        unique: true,
      })
    );
    expect(createIdx).toBe('CREATE UNIQUE INDEX "idx_users_email" ON "users" ("email");');

    const dropIdx = compiler.compile(new DropIndexOperation('users', 'idx_users_email'));
    expect(dropIdx).toBe('DROP INDEX "idx_users_email";');
  });

  it('should compile AddForeignKey and DropForeignKey operations', () => {
    const compiler = new SqlMigrationCompiler('memory');

    const addFk = compiler.compile(
      new AddForeignKeyOperation('posts', {
        name: 'fk_posts_user_id',
        columns: ['user_id'],
        referencedTable: 'users',
        referencedColumns: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      })
    );
    expect(addFk).toBe(
      'ALTER TABLE "posts" ADD CONSTRAINT "fk_posts_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;'
    );

    const dropFk = compiler.compile(new DropForeignKeyOperation('posts', 'fk_posts_user_id'));
    expect(dropFk).toBe('ALTER TABLE "posts" DROP CONSTRAINT "fk_posts_user_id";');
  });

  it('should reject invalid identifiers to prevent SQL injection', () => {
    const compiler = new SqlMigrationCompiler('memory');

    expect(() => compiler.quoteIdentifier('users; DROP TABLE users;')).toThrow(
      /Invalid SQL identifier/
    );
    expect(() => compiler.quoteIdentifier('123abc')).toThrow(/Invalid SQL identifier/);
    expect(() => compiler.quoteIdentifier('users-table')).toThrow(/Invalid SQL identifier/);
  });
});
