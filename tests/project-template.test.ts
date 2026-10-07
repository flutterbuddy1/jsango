/**
 * `jsango new` must produce a project that type-checks against the published `jsango` types
 * and whose database workflow runs (makemigrations -> migrate) without edits.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';
import { CliApplication, CliOutput } from '../packages/cli/dist/index.js';
import { clearDatabaseManager, defaultModelRegistry } from '../packages/orm/dist/index.js';

const WORK = path.join(__dirname, `.tmp-template-${process.pid}`);
const PROJECT = path.join(WORK, 'demo-app');
const originalCwd = process.cwd();

async function cli(cwd: string, ...args: string[]): Promise<{ code: number; out: string }> {
  let out = '';
  const output = new CliOutput({
    color: false,
    stdout: { write: (s: string) => (out += s) },
    stderr: { write: (s: string) => (out += s) },
  });
  process.chdir(cwd);
  try {
    return { code: await CliApplication.createDefault().run(args, output), out };
  } finally {
    process.chdir(originalCwd);
  }
}

describe('project template', () => {
  afterAll(() => {
    clearDatabaseManager();
    process.chdir(originalCwd);
    fs.rmSync(WORK, { recursive: true, force: true });
  });

  it('creates the project files', async () => {
    fs.rmSync(WORK, { recursive: true, force: true });
    fs.mkdirSync(WORK, { recursive: true });
    const { code } = await cli(WORK, 'new', 'demo-app');
    expect(code).toBe(0);
    for (const file of [
      'package.json',
      'jsango.config.ts',
      'src/index.ts',
      'src/database.ts',
      'src/models/user.ts',
      'migrations/.gitkeep',
      '.env',
      '.env.example',
      '.gitignore',
      'AGENTS.md',
      'CLAUDE.md',
    ]) {
      expect(fs.existsSync(path.join(PROJECT, file)), file).toBe(true);
    }
    const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT, 'package.json'), 'utf8'));
    expect(pkg.scripts.migrate).toBe('jsango migrate');
    expect(pkg.scripts.makemigrations).toBe('jsango migrate:generate');
  });

  it('type-checks against the jsango package (including make:admin output)', async () => {
    const generated = await cli(PROJECT, 'make:admin', 'Product');
    expect(generated.code).toBe(0);
    expect(generated.out).toContain('app.admin({ resources: [ProductResource] })');
    const files = ['src/index.ts', 'src/database.ts', 'src/models/user.ts', 'jsango.config.ts', 'src/admin/product-resource.ts', 'src/models/product.ts'].map((f) =>
      path.join(PROJECT, f)
    );
    const program = ts.createProgram(files, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      types: ['node'],
      typeRoots: [path.join(originalCwd, 'node_modules', '@types')],
    });
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      // dotenv is a dependency of the generated app, not of this monorepo
      .filter((d) => !ts.flattenDiagnosticMessageText(d.messageText, '\n').includes("'dotenv/config'"));
    const messages = diagnostics.map(
      (d) =>
        `${d.file ? path.relative(PROJECT, d.file.fileName) : ''}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`
    );
    expect(messages).toEqual([]);
  });

  it('runs makemigrations and migrate on the default SQLite database', async () => {
    defaultModelRegistry.clear();
    const gen = await cli(PROJECT, 'makemigrations');
    expect(gen.out).toContain('Created migration');
    expect(gen.code).toBe(0);

    const run = await cli(PROJECT, 'migrate');
    expect(run.out).toContain('Applied 1 migration(s)');
    expect(run.code).toBe(0);
    expect(fs.existsSync(path.join(PROJECT, 'db.sqlite3'))).toBe(true);
  });
});
