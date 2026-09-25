import { describe, it, expect } from 'vitest';
import * as child_process from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const binPath = path.resolve(__dirname, '../../dist/bin/django-js.js');

describe('CLI Process Integration Tests', () => {
  it('executes --version with exit code 0 and stdout output', () => {
    const res = child_process.spawnSync(process.execPath, [binPath, '--version'], {
      encoding: 'utf8',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('django-js v1.0.0');
    expect(res.stderr).toBe('');
  });

  it('executes --help with exit code 0 and stdout output', () => {
    const res = child_process.spawnSync(process.execPath, [binPath, '--help'], {
      encoding: 'utf8',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('django-js — Production-grade TypeScript backend framework');
    expect(res.stderr).toBe('');
  });

  it('outputs valid JSON for global help with --json flag', () => {
    const res = child_process.spawnSync(process.execPath, [binPath, '--json'], {
      encoding: 'utf8',
    });
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout.trim()) as { framework: string; commands: unknown[] };
    expect(parsed.framework).toBe('django-js');
    expect(Array.isArray(parsed.commands)).toBe(true);
  });

  it('exits with code 2 on unknown command and prints suggestion to stderr', () => {
    const res = child_process.spawnSync(process.execPath, [binPath, 'route:lis'], {
      encoding: 'utf8',
    });
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('Unknown command "route:lis". Did you mean "route:list"?');
  });

  it('exits with code 2 on unknown option', () => {
    const res = child_process.spawnSync(process.execPath, [binPath, 'version', '--fake-option'], {
      encoding: 'utf8',
    });
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('Unknown option "--fake-option"');
  });

  it('executes doctor command with exit code 0', () => {
    const res = child_process.spawnSync(process.execPath, [binPath, 'doctor'], {
      encoding: 'utf8',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Nexora Diagnostic Report');
    expect(res.stdout).toContain('Node.js Version');
  });
});
