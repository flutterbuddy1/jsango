import { describe, it, expect } from 'vitest';
import { MigrationGenerator } from '../public/generator.js';
import { SchemaDiff } from '../public/diff.js';
import { CreateTableOperation, DropColumnOperation } from '../public/operations.js';

describe('MigrationGenerator', () => {
  it('should generate human-readable TypeScript migration file', () => {
    const diff = new SchemaDiff([
      new CreateTableOperation({
        name: 'profiles',
        columns: [
          { name: 'id', type: 'integer', primaryKey: true, autoIncrement: true },
          { name: 'bio', type: 'text' },
        ],
      }),
    ]);

    const generated = MigrationGenerator.generate('create_profiles', diff, {
      timestamp: '20260924120000',
    });

    expect(generated.id).toBe('20260924120000_create_profiles');
    expect(generated.fileName).toBe('20260924120000_create_profiles.ts');
    expect(generated.content).toContain("export const id = '20260924120000_create_profiles';");
    expect(generated.content).toContain("export const name = 'create_profiles';");
    expect(generated.content).toContain('new CreateTableOperation');
    expect(generated.content).toContain('"name": "profiles"');
  });

  it('should include destructive change warning in generated comments when destructive', () => {
    const diff = new SchemaDiff([new DropColumnOperation('users', 'legacy_token')]);

    const generated = MigrationGenerator.generate('drop_legacy_token', diff, {
      timestamp: '20260924123000',
    });

    expect(generated.content).toContain(
      'WARNING: This migration contains POTENTIALLY DESTRUCTIVE changes'
    );
    expect(generated.content).toContain('[drop_column]');
  });
});
