import { describe, it, expect } from 'vitest';
import {
  CreateTableOperation,
  DropTableOperation,
  AddColumnOperation,
  DropColumnOperation,
  AlterColumnOperation,
  RawSqlOperation,
} from '../public/operations.js';

describe('Migration Operations', () => {
  it('should verify CreateTable and DropTable reversibility', () => {
    const create = new CreateTableOperation({
      name: 'users',
      columns: [{ name: 'id', type: 'integer', primaryKey: true }],
    });

    expect(create.isDestructive).toBe(false);
    expect(create.isReversible).toBe(true);

    const reverse = create.getReverse();
    expect(reverse).toBeInstanceOf(DropTableOperation);
    expect(reverse.tableName).toBe('users');
    expect(reverse.isDestructive).toBe(true);

    const reverseReverse = reverse.getReverse();
    expect(reverseReverse).toBeInstanceOf(CreateTableOperation);
  });

  it('should verify AddColumn and DropColumn reversibility', () => {
    const add = new AddColumnOperation('users', { name: 'bio', type: 'text' });
    expect(add.isDestructive).toBe(false);
    expect(add.isReversible).toBe(true);

    const drop = add.getReverse();
    expect(drop).toBeInstanceOf(DropColumnOperation);
    expect(drop.isDestructive).toBe(true);
    expect(drop.isReversible).toBe(true);

    const blindDrop = new DropColumnOperation('users', 'bio');
    expect(blindDrop.isReversible).toBe(false);
    expect(blindDrop.getReverse()).toBeNull();
  });

  it('should detect destructive column alterations', () => {
    const safeAlter = new AlterColumnOperation(
      'users',
      { name: 'name', type: 'string', length: 255 },
      { name: 'name', type: 'string', length: 100 }
    );
    expect(safeAlter.isDestructive).toBe(false);

    const narrowingAlter = new AlterColumnOperation(
      'users',
      { name: 'name', type: 'string', length: 50 },
      { name: 'name', type: 'string', length: 100 }
    );
    expect(narrowingAlter.isDestructive).toBe(true);

    const typeChangeAlter = new AlterColumnOperation(
      'users',
      { name: 'age', type: 'integer' },
      { name: 'age', type: 'string' }
    );
    expect(typeChangeAlter.isDestructive).toBe(true);
  });

  it('should verify RawSqlOperation reversibility', () => {
    const reversibleSql = new RawSqlOperation({
      upSql: 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
      downSql: 'DROP EXTENSION IF EXISTS "uuid-ossp";',
    });
    expect(reversibleSql.isReversible).toBe(true);
    const rev = reversibleSql.getReverse();
    expect(rev?.upSql).toBe('DROP EXTENSION IF EXISTS "uuid-ossp";');

    const oneWaySql = new RawSqlOperation({
      upSql: 'VACUUM FULL;',
    });
    expect(oneWaySql.isReversible).toBe(false);
    expect(oneWaySql.getReverse()).toBeNull();
  });
});
