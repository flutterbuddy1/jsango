import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CliApplication } from '../public/app.js';
import { CliOutput } from '../public/output.js';
import { Application } from '@django-js/middleware';
import { DatabaseManager, MemoryDatabaseDriver } from '@django-js/database';
import { defineModel, fields, setDatabaseManager, defaultModelRegistry } from '@django-js/orm';
import { CreateTableOperation, Migration, MigrationRegistry } from '@django-js/migrations';
import { ExitCode } from '../public/types.js';

describe('Built-in Commands', () => {
  let app: CliApplication;
  let stdoutData: string;
  let _stderrData: string;
  let output: CliOutput;

  beforeEach(() => {
    app = CliApplication.createDefault();
    stdoutData = '';
    _stderrData = '';
    output = new CliOutput({
      color: false,
      stdout: {
        write: (str: string) => {
          stdoutData += str;
        },
      },
      stderr: {
        write: (str: string) => {
          _stderrData += str;
        },
      },
    });
  });

  describe('version', () => {
    it('should output version in text mode', async () => {
      const code = await app.run(['version'], output);
      expect(code).toBe(ExitCode.SUCCESS);
      expect(stdoutData).toContain('django-js v0.0.1');
    });

    it('should output version in json mode', async () => {
      const code = await app.run(['--json', 'version'], output);
      expect(code).toBe(ExitCode.SUCCESS);
      const parsed = JSON.parse(stdoutData.trim()) as Record<string, unknown>;
      expect(parsed['framework']).toBe('django-js');
      expect(parsed['version']).toBe('0.0.1');
    });
  });

  describe('help', () => {
    it('should display global help when no arguments are provided', async () => {
      const code = await app.run([], output);
      expect(code).toBe(ExitCode.SUCCESS);
      expect(stdoutData).toContain('django-js — Production-grade TypeScript backend framework');
      expect(stdoutData).toContain('AVAILABLE COMMANDS');
    });

    it('should display command-specific help', async () => {
      const code = await app.run(['help', 'migrate:run'], output);
      expect(code).toBe(ExitCode.SUCCESS);
      expect(stdoutData).toContain('COMMAND: migrate:run');
      expect(stdoutData).toContain('USAGE');
      expect(stdoutData).toContain('OPTIONS');
    });
  });

  describe('doctor', () => {
    it('should run diagnostic checks successfully', async () => {
      const code = await app.run(['doctor'], output);
      expect(code).toBe(ExitCode.SUCCESS);
      expect(stdoutData).toContain('Nexora Diagnostic Report');
      expect(stdoutData).toContain('Node.js Version');
    });

    it('should output diagnostic checks in json mode', async () => {
      const code = await app.run(['doctor', '--json'], output);
      expect(code).toBe(ExitCode.SUCCESS);
      const parsed = JSON.parse(stdoutData.trim()) as { checks: unknown[] };
      expect(Array.isArray(parsed.checks)).toBe(true);
      expect(parsed.checks.length).toBeGreaterThan(0);
    });
  });

  describe('route:list', () => {
    it('should list routes and support filtering', async () => {
      const testApp = new Application();
      testApp.get('/users', () => 'users', { name: 'users.index' });
      testApp.post('/users', () => 'create user', { name: 'users.store' });
      testApp.get('/posts', () => 'posts', { name: 'posts.index' });

      // Run via command execution with mock application
      const cmd = app.registry.resolve('route:list')!;
      const ctx = new (await import('../public/context.js')).CommandContext({
        application: testApp,
        output,
      });

      const code = await cmd.execute(ctx);
      expect(code).toBe(ExitCode.SUCCESS);
      expect(stdoutData).toContain('/users');
      expect(stdoutData).toContain('/posts');
      expect(stdoutData).toContain('users.index');

      // Test filtering by method
      stdoutData = '';
      const filterCtx = new (await import('../public/context.js')).CommandContext({
        application: testApp,
        options: { method: 'POST' },
        output,
      });
      await cmd.execute(filterCtx);
      expect(stdoutData).toContain('/users');
      expect(stdoutData).not.toContain('/posts');
    });
  });

  describe('model:list and model:show', () => {
    it('should list models and show model details', async () => {
      defaultModelRegistry.clear();
      defineModel({
        name: 'Article',
        table: 'articles',
        fields: {
          id: fields.integer({ primaryKey: true, autoIncrement: true }),
          title: fields.string(),
        },
      });

      const listCmd = app.registry.resolve('model:list')!;
      const ctx = new (await import('../public/context.js')).CommandContext({ output });

      const listCode = await listCmd.execute(ctx);
      expect(listCode).toBe(ExitCode.SUCCESS);
      expect(stdoutData).toContain('Article');
      expect(stdoutData).toContain('articles');

      // Test model:show
      stdoutData = '';
      const showCmd = app.registry.resolve('model:show')!;
      const showCtx = new (await import('../public/context.js')).CommandContext({
        args: ['Article'],
        output,
      });
      const showCode = await showCmd.execute(showCtx);
      expect(showCode).toBe(ExitCode.SUCCESS);
      expect(stdoutData).toContain('MODEL: Article');
      expect(stdoutData).toContain('title');
      expect(stdoutData).toContain('Primary Key');
    });
  });

  describe('config:show', () => {
    it('should display configuration and mask secrets', async () => {
      const cmd = app.registry.resolve('config:show')!;
      const ctx = new (await import('../public/context.js')).CommandContext({
        output,
      });
      (ctx as unknown as { _config: unknown })._config = {
        values: {
          appName: 'django-js-app',
          dbPassword: 'super-secret-password-123',
          apiKey: 'token-abc-987',
        },
      };

      const code = await cmd.execute(ctx);
      expect(code).toBe(ExitCode.SUCCESS);
      expect(stdoutData).toContain('appName');
      expect(stdoutData).toContain('django-js-app');
      expect(stdoutData).toContain('********');
      expect(stdoutData).not.toContain('super-secret-password-123');
      expect(stdoutData).not.toContain('token-abc-987');
    });
  });

  describe('db:status', () => {
    it('should report database connection health', async () => {
      const memoryDriver = new MemoryDatabaseDriver();
      const db = new DatabaseManager({
        default: 'default',
        connections: {
          default: { driver: 'memory' },
        },
      });
      db.registerDriver('memory', memoryDriver);

      const cmd = app.registry.resolve('db:status')!;
      const ctx = new (await import('../public/context.js')).CommandContext({
        databaseManager: db,
        output,
      });

      const code = await cmd.execute(ctx);
      expect(code).toBe(ExitCode.SUCCESS);
      expect(stdoutData).toContain('HEALTHY');
      expect(stdoutData).toContain('PONG');

      await db.close();
    });
  });

  describe('migrations commands', () => {
    let db: DatabaseManager;
    let reg: MigrationRegistry;

    beforeEach(() => {
      const memoryDriver = new MemoryDatabaseDriver();
      db = new DatabaseManager({
        default: 'default',
        connections: {
          default: { driver: 'memory' },
        },
      });
      db.registerDriver('memory', memoryDriver);
      setDatabaseManager(db);

      reg = new MigrationRegistry();
      reg.register(
        new Migration({
          id: '20260924000000_create_test_table',
          name: 'create_test_table',
          operations: [
            new CreateTableOperation({
              name: 'test_table',
              columns: [{ name: 'id', type: 'integer', primaryKey: true }],
            }),
          ],
        })
      );
    });

    afterEach(async () => {
      await db.close();
    });

    it('should report migrate:status, execute migrate:run, and rollback with migrate:rollback', async () => {
      // 1. Status before migrate
      const statusCmd = app.registry.resolve('migrate:status')!;
      let ctx = new (await import('../public/context.js')).CommandContext({
        databaseManager: db,
        migrationRegistry: reg,
        output,
      });

      let code = await statusCmd.execute(ctx);
      expect(code).toBe(ExitCode.SUCCESS);
      expect(stdoutData).toContain('20260924000000_create_test_table');
      expect(stdoutData).toContain('Pending migrations');

      // 2. Run migration
      stdoutData = '';
      const runCmd = app.registry.resolve('migrate:run')!;
      ctx = new (await import('../public/context.js')).CommandContext({
        databaseManager: db,
        migrationRegistry: reg,
        output,
      });
      code = await runCmd.execute(ctx);
      expect(code).toBe(ExitCode.SUCCESS);
      expect(stdoutData).toContain('Applied 1 migration(s)');

      // 3. Status after migrate
      stdoutData = '';
      ctx = new (await import('../public/context.js')).CommandContext({
        databaseManager: db,
        migrationRegistry: reg,
        output,
      });
      code = await statusCmd.execute(ctx);
      expect(code).toBe(ExitCode.SUCCESS);
      expect(stdoutData).toContain('Up to date');

      // 4. Rollback
      stdoutData = '';
      const rollbackCmd = app.registry.resolve('migrate:rollback')!;
      ctx = new (await import('../public/context.js')).CommandContext({
        databaseManager: db,
        migrationRegistry: reg,
        output,
      });
      code = await rollbackCmd.execute(ctx);
      expect(code).toBe(ExitCode.SUCCESS);
      expect(stdoutData).toContain('Rolled back 1 migration(s)');
    });
  });

  describe('create project scaffolding', () => {
    const tempDir = path.join(process.cwd(), 'scratch_test_project_temp');

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should create new project structure and files', async () => {
      const createCmd = app.registry.resolve('create')!;
      const ctx = new (await import('../public/context.js')).CommandContext({
        args: ['scratch_test_project_temp'],
        cwd: process.cwd(),
        output,
      });

      const code = await createCmd.execute(ctx);
      expect(code).toBe(ExitCode.SUCCESS);
      expect(fs.existsSync(tempDir)).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'tsconfig.json'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'src', 'index.ts'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'README.md'))).toBe(true);
    });
  });
});
