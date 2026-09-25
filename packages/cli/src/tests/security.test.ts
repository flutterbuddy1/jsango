import { describe, it, expect } from 'vitest';
import { MaskUtil } from '../internal/mask.js';
import { ProjectDiscovery } from '../internal/project.js';
import { ProjectCreateCommand } from '../commands/project-create.js';
import { CommandContext } from '../public/context.js';
import { CliOutput } from '../public/output.js';
import { DestructiveOperationError, UsageError } from '../public/errors.js';
import { MigrateRunCommand } from '../commands/migrate-run.js';
import { Migration, MigrationRegistry } from '@django-js/migrations';
import { DatabaseManager, MemoryDatabaseDriver } from '@django-js/database';
import { DropTableOperation } from '@django-js/migrations';

describe('CLI Security Tests', () => {
  describe('Secret Masking', () => {
    it('should detect and mask sensitive keys in nested objects', () => {
      const sensitiveConfig = {
        app: {
          name: 'my-app',
          dbPassword: 'secret-db-pass',
          jwtSecret: 'super-secret-jwt-token-key',
          apiKey: 'AIzaSyD-abc',
        },
        connectionString: 'postgres://postgres:mypassword123@localhost:5432/mydb',
      };

      const masked = MaskUtil.maskValue(sensitiveConfig) as typeof sensitiveConfig;
      expect(masked.app.dbPassword).toBe('********');
      expect(masked.app.jwtSecret).toBe('********');
      expect(masked.app.apiKey).toBe('********');
      expect(masked.app.name).toBe('my-app');
      expect(masked.connectionString).toBe('postgres://postgres:********@localhost:5432/mydb');
    });
  });

  describe('Path Traversal Defense', () => {
    it('should reject path traversal in assertSafePath', () => {
      const rootDir = '/Users/test/project';
      expect(() => ProjectDiscovery.assertSafePath('../../../etc/passwd', rootDir)).toThrow(
        'Path traversal detected'
      );
    });

    it('should reject project creation with path traversal or invalid names', () => {
      const cmd = new ProjectCreateCommand();
      const output = new CliOutput({ color: false });
      const ctx = new CommandContext({
        args: ['../../malicious_dir'],
        cwd: process.cwd(),
        output,
      });

      expect(() => cmd.execute(ctx)).toThrow(UsageError);
    });
  });

  describe('Destructive Operation Protection', () => {
    it('should reject destructive migrations without --force or --yes', async () => {
      const memoryDriver = new MemoryDatabaseDriver();
      const db = new DatabaseManager({
        default: 'default',
        connections: {
          default: { driver: 'memory' },
        },
      });
      db.registerDriver('memory', memoryDriver);

      const reg = new MigrationRegistry();
      reg.register(
        new Migration({
          id: '001_destructive',
          name: 'drop_users',
          operations: [new DropTableOperation('users')],
        })
      );

      const cmd = new MigrateRunCommand();
      const output = new CliOutput({ color: false });
      const ctx = new CommandContext({
        databaseManager: db,
        migrationRegistry: reg,
        options: { yes: false, force: false },
        output,
      });

      await expect(cmd.execute(ctx)).rejects.toThrow(DestructiveOperationError);
      await db.close();
    });
  });
});
