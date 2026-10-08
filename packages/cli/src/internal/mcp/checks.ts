import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ApiIndex } from './api-index.js';

interface StepResult {
  readonly name: string;
  readonly status: 'passed' | 'failed' | 'skipped';
  readonly detail: string;
  readonly ms: number;
}

const MAX_STEP_OUTPUT = 6000;

/** Libraries jsango replaces; importing them in a jsango project is almost always a mistake. */
const REPLACED: Record<string, string> = {
  express: 'createApp() + app.get/post',
  fastify: 'createApp() + app.get/post',
  koa: 'createApp() + app.get/post',
  prisma: 'defineModel + fields (ORM) and jsango makemigrations',
  '@prisma/client': 'defineModel + fields (ORM)',
  typeorm: 'defineModel + fields (ORM)',
  sequelize: 'defineModel + fields (ORM)',
  mongoose: 'defineModel + fields (ORM, works on MongoDB)',
  knex: 'Model.query() query builder',
  passport: 'createAuth()',
  jsonwebtoken: 'createAuth() (tokens) or JwtService',
  bcrypt: 'auth.hashPassword() / ScryptPasswordHasher',
  bcryptjs: 'auth.hashPassword() / ScryptPasswordHasher',
  zod: 'validate({ body: schema({...}) }) with string(), number(), ...',
  joi: 'validate({ body: schema({...}) })',
  bullmq: 'jobs.register / jobs.dispatch',
  'socket.io': 'app.ws(path, handler)',
};

function run(cmd: string, args: string[], cwd: string, timeoutMs: number): Promise<{ code: number | null; output: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }, shell: process.platform === 'win32' && cmd === 'npm' });
    let output = '';
    child.stdout.on('data', (d: Buffer) => (output += d.toString()));
    child.stderr.on('data', (d: Buffer) => (output += d.toString()));
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: 1, output: output + String(err), timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, output, timedOut });
    });
  });
}

function findUp(from: string, rel: string): string | undefined {
  let dir = path.resolve(from);
  for (;;) {
    if (fs.existsSync(path.join(dir, rel))) return path.join(dir, rel);
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function trim(output: string): string {
  const text = output.trim();
  return text.length > MAX_STEP_OUTPUT ? text.slice(0, MAX_STEP_OUTPUT) + '\n… (output truncated)' : text;
}

/** Turns common compiler errors into jsango-specific advice. */
export function hintsFor(tscOutput: string, index: ApiIndex): string[] {
  const hints = new Set<string>();
  for (const m of tscOutput.matchAll(/Module '"jsango"' has no exported member '([\w$]+)'/g)) {
    hints.add(`"${m[1]}" is not exported by jsango. ${index.lookup(m[1]!).split('\n')[0]}`);
  }
  for (const m of tscOutput.matchAll(/Property '([\w$]+)' does not exist on type '([\w$]+)/g)) {
    const [, prop, type] = m as unknown as [string, string, string];
    if (index.names().includes(type)) {
      const first = index.lookup(`${type}.${prop}`).split('\n')[0]!;
      if (first.includes('has no member')) hints.add(first);
    }
  }
  for (const m of tscOutput.matchAll(/Cannot find module '([^']+)'/g)) {
    const lib = m[1]!;
    if (REPLACED[lib]) hints.add(`Don't add "${lib}" to a jsango project: use ${REPLACED[lib]}.`);
  }
  return [...hints];
}

export interface CheckOptions {
  readonly tests?: boolean | undefined;
}

/**
 * Runs the project's checks the way AGENTS.md asks: type-check, migrations in sync with the
 * models, and optionally the test suite. Returns a report an agent can act on.
 */
export async function runChecks(cwd: string, index: ApiIndex, options: CheckOptions = {}): Promise<string> {
  const steps: StepResult[] = [];
  const hints: string[] = [];

  // 1. TypeScript
  let started = Date.now();
  const tsc = findUp(cwd, 'node_modules/typescript/bin/tsc');
  if (!tsc) {
    steps.push({ name: 'typecheck', status: 'skipped', detail: 'typescript is not installed (npm install -D typescript).', ms: 0 });
  } else {
    const res = await run(process.execPath, [tsc, '--noEmit', '--pretty', 'false', '-p', cwd], cwd, 180_000);
    const ok = res.code === 0 && !res.timedOut;
    steps.push({ name: 'typecheck (tsc --noEmit)', status: ok ? 'passed' : 'failed', detail: res.timedOut ? 'Timed out after 180s.' : trim(res.output), ms: Date.now() - started });
    if (!ok) hints.push(...hintsFor(res.output, index));
  }

  // 2. Migrations match the models
  started = Date.now();
  if (!fs.existsSync(path.join(cwd, 'jsango.config.ts')) && !fs.existsSync(path.join(cwd, 'jsango.config.js'))) {
    steps.push({ name: 'migrate:check', status: 'skipped', detail: 'No jsango.config.ts in this directory.', ms: 0 });
  } else {
    const bin = fileURLToPath(new URL('../../bin/jsango.js', import.meta.url));
    const res = await run(process.execPath, [bin, 'migrate:check', '--no-color'], cwd, 120_000);
    const ok = res.code === 0 && !res.timedOut;
    steps.push({ name: 'migrate:check', status: ok ? 'passed' : 'failed', detail: res.timedOut ? 'Timed out after 120s.' : trim(res.output), ms: Date.now() - started });
    if (!ok && /migration/i.test(res.output)) {
      hints.push('Models and migrations differ: run `npx jsango makemigrations`, review the file, then `npx jsango migrate`.');
    }
  }

  // 3. Tests (opt-in: they can be slow or need services)
  started = Date.now();
  const pkg = fs.existsSync(path.join(cwd, 'package.json'))
    ? (JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')) as { scripts?: Record<string, string> })
    : {};
  if (!options.tests) {
    steps.push({ name: 'tests', status: 'skipped', detail: 'Not requested (call run_check with { "tests": true }).', ms: 0 });
  } else if (!pkg.scripts?.['test']) {
    steps.push({ name: 'tests', status: 'skipped', detail: 'package.json has no "test" script.', ms: 0 });
  } else {
    const res = await run('npm', ['test', '--silent'], cwd, 300_000);
    const ok = res.code === 0 && !res.timedOut;
    steps.push({ name: 'tests (npm test)', status: ok ? 'passed' : 'failed', detail: res.timedOut ? 'Timed out after 300s.' : trim(res.output), ms: Date.now() - started });
  }

  const failed = steps.filter((s) => s.status === 'failed').length;
  const icon = { passed: '✓', failed: '✗', skipped: '–' } as const;
  return [
    failed === 0 ? 'All checks passed.' : `${failed} check(s) failed.`,
    '',
    ...steps.map((s) => `${icon[s.status]} ${s.name}: ${s.status}${s.ms ? ` (${(s.ms / 1000).toFixed(1)}s)` : ''}${s.status === 'passed' || !s.detail ? '' : `\n${s.detail}`}`),
    ...(hints.length ? ['', 'Hints:', ...hints.map((h) => `- ${h}`)] : []),
  ].join('\n');
}
