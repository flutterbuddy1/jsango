/**
 * `jsango mcp` end to end: a real `jsango new` project, the real CLI process speaking MCP over stdio,
 * and the three tools an AI agent uses (get_api, search_docs, run_check).
 */
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { redact, draftIssue, findSimilarIssues } from '../packages/cli/dist/index.js';

const ROOT = path.resolve(__dirname, '..');
const BIN = path.join(ROOT, 'packages/cli/dist/bin/jsango.js');
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'jsango-mcp-'));
const PROJECT = path.join(WORK, 'shop');

function cli(cwd: string, ...args: string[]) {
  return spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

class McpProcess {
  private readonly child: ChildProcessWithoutNullStreams;
  private buffer = '';
  private nextId = 1;
  private readonly waiting = new Map<number, (msg: any) => void>();

  public constructor(cwd: string, env: Record<string, string> = {}) {
    this.child = spawn(process.execPath, [BIN, 'mcp'], { cwd, env: { ...process.env, ...env } });
    this.child.stdout.on('data', (d: Buffer) => {
      this.buffer += d.toString();
      let nl: number;
      while ((nl = this.buffer.indexOf('\n')) !== -1) {
        const msg = JSON.parse(this.buffer.slice(0, nl));
        this.buffer = this.buffer.slice(nl + 1);
        this.waiting.get(msg.id)?.(msg);
      }
    });
  }

  public request(method: string, params?: unknown): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
      this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  public notify(method: string): void {
    this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n');
  }

  public async tool(name: string, args: Record<string, unknown> = {}): Promise<string> {
    const res = await this.request('tools/call', { name, arguments: args });
    return res.result.content[0].text as string;
  }

  public close(): Promise<number | null> {
    return new Promise((resolve) => {
      this.child.on('close', resolve);
      this.child.stdin.end();
    });
  }
}

let mcp: McpProcess;
let fakeGitHub: http.Server;
const searches: string[] = [];

beforeAll(async () => {
  // Stand-in for api.github.com so duplicate search is deterministic and offline.
  fakeGitHub = http.createServer((req, res) => {
    searches.push(decodeURIComponent(req.url ?? ''));
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        items: [
          {
            title: 'paginate ignores orderBy',
            html_url: 'https://github.com/flutterbuddy1/jsango/issues/42',
            state: 'open',
          },
        ],
      })
    );
  });
  await new Promise<void>((r) => fakeGitHub.listen(0, '127.0.0.1', r));
  expect(cli(WORK, 'new', 'shop').status).toBe(0);
  // Link the workspace build in place of `npm install`.
  const nm = path.join(PROJECT, 'node_modules');
  fs.mkdirSync(path.join(nm, '@types'), { recursive: true });
  fs.symlinkSync(path.join(ROOT, 'packages/jsango'), path.join(nm, 'jsango'));
  fs.symlinkSync(path.join(ROOT, 'node_modules/typescript'), path.join(nm, 'typescript'));
  fs.symlinkSync(path.join(ROOT, 'node_modules/@types/node'), path.join(nm, '@types/node'));
  const { port } = fakeGitHub.address() as { port: number };
  mcp = new McpProcess(PROJECT, { JSANGO_GITHUB_API: `http://127.0.0.1:${port}` });
});

afterAll(async () => {
  await mcp?.close();
  fakeGitHub?.close();
  fs.rmSync(WORK, { recursive: true, force: true });
});

describe('jsango mcp', () => {
  it('handshakes with instructions and lists its tools', async () => {
    const init = await mcp.request('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    });
    expect(init.result.serverInfo.name).toBe('jsango');
    expect(init.result.instructions).toContain('get_api');
    mcp.notify('notifications/initialized');
    const { result } = await mcp.request('tools/list');
    expect(result.tools.map((t: { name: string }) => t.name)).toEqual([
      'get_api',
      'search_docs',
      'run_check',
      'report_issue',
    ]);
  });

  it('get_api returns real signatures and corrects wrong names', async () => {
    const createAuth = await mcp.tool('get_api', { name: 'createAuth' });
    expect(createAuth).toContain('from @jsango/auth');
    expect(createAuth).toMatch(/export declare function createAuth/);

    expect(await mcp.tool('get_api', { name: 'fields.string' })).toMatch(
      /string: <T = string>\(options\?/
    );
    expect(await mcp.tool('get_api', { name: 'QueryBuilder.paginate' })).toContain(
      'paginate(options: PaginationOptions)'
    );

    expect(await mcp.tool('get_api', { name: 'createAuh' })).toMatch(
      /No export named "createAuh".*Did you mean: .*createAuth/
    );
    expect(await mcp.tool('get_api', { name: 'QueryBuilder.paginated' })).toMatch(
      /has no member "paginated"\. Did you mean: paginate/
    );
  });

  it('search_docs finds the right guide sections', async () => {
    const res = await mcp.tool('search_docs', { query: 'refresh token rotation reuse' });
    expect(res).toContain('docs/auth/README.md');
    expect(await mcp.tool('search_docs', { query: 'makemigrations rename column' })).toContain(
      'docs/database/README.md'
    );
  });

  it('run_check reports failures with jsango hints, then passes once fixed', async () => {
    // A fresh project has a model without a migration.
    let report = await mcp.tool('run_check');
    expect(report).toContain('✓ typecheck (tsc --noEmit): passed');
    expect(report).toContain('✗ migrate:check: failed');
    expect(report).toContain('npx jsango makemigrations');

    // Typical agent mistakes: an invented export, a missing method, another framework.
    fs.writeFileSync(
      path.join(PROJECT, 'src/mistakes.ts'),
      [
        "import { createRouter } from 'jsango';",
        "import express from 'express';",
        "import { User } from './models/user.js';",
        'export const q = User.query().paginated({ page: 1 });',
        'export { createRouter, express };',
      ].join('\n')
    );
    report = await mcp.tool('run_check');
    expect(report).toContain('✗ typecheck (tsc --noEmit): failed');
    expect(report).toMatch(/"createRouter" is not exported by jsango\..*Did you mean/);
    expect(report).toMatch(/has no member "paginated"\. Did you mean: paginate/);
    expect(report).toContain(`Don't add "express" to a jsango project`);

    fs.rmSync(path.join(PROJECT, 'src/mistakes.ts'));
    expect(cli(PROJECT, 'makemigrations').status).toBe(0);
    expect(cli(PROJECT, 'migrate').status).toBe(0);
    report = await mcp.tool('run_check');
    expect(report.startsWith('All checks passed.')).toBe(true);
  }, 120_000);
});

describe('jsango ai:init MCP configs', () => {
  it('adds the server for Claude Code, Cursor and VS Code without clobbering existing config', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsango-mcpcfg-'));
    try {
      fs.mkdirSync(path.join(dir, '.vscode'));
      fs.writeFileSync(
        path.join(dir, '.vscode/mcp.json'),
        JSON.stringify({ servers: { other: { command: 'x' } } })
      );
      fs.mkdirSync(path.join(dir, '.cursor'));
      fs.writeFileSync(path.join(dir, '.cursor/mcp.json'), '{ // comments\n}');
      expect(cli(dir, 'ai:init').status).toBe(0);

      const claude = JSON.parse(fs.readFileSync(path.join(dir, '.mcp.json'), 'utf8'));
      expect(claude).toEqual({
        mcpServers: { jsango: { command: 'npx', args: ['jsango', 'mcp'] } },
      });
      const vscode = JSON.parse(fs.readFileSync(path.join(dir, '.vscode/mcp.json'), 'utf8'));
      expect(vscode.servers).toEqual({
        other: { command: 'x' },
        jsango: { type: 'stdio', command: 'npx', args: ['jsango', 'mcp'] },
      });
      expect(fs.readFileSync(path.join(dir, '.cursor/mcp.json'), 'utf8')).toBe('{ // comments\n}'); // left alone
      expect(fs.existsSync(path.join(PROJECT, '.mcp.json'))).toBe(true); // `jsango new` writes them too
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('report_issue', () => {
  it('drafts a redacted issue, finds duplicates and never submits', async () => {
    fs.appendFileSync(path.join(PROJECT, '.env'), '\nAUTH_SECRET=s3cr3t-value-from-env-file-123\n');
    const res = await mcp.tool('report_issue', {
      kind: 'bug',
      title: 'paginate() ignores orderBy',
      summary: `Fails in ${PROJECT}/src/index.ts with key s3cr3t-value-from-env-file-123 for me@company.com`,
      reproduction: "await Post.query().orderBy('id', 'DESC').paginate({ page: 1, pageSize: 2 })",
      actual: 'Rows come back ascending',
    });
    expect(res).toContain('Do not submit anything yourself');
    expect(res).toContain('https://github.com/flutterbuddy1/jsango/issues/42'); // duplicate surfaced
    expect(searches.at(-1)).toContain(
      'repo:flutterbuddy1/jsango is:issue paginate ignores orderby'
    );
    expect(res).not.toContain('s3cr3t-value-from-env-file-123');
    expect(res).not.toContain('me@company.com');
    expect(res).not.toContain(PROJECT);
    expect(res).toMatch(/- jsango: \d+\.\d+\.\d+/);
    expect(res).toContain('Database driver: sqlite');
    const link = /https:\/\/github\.com\/flutterbuddy1\/jsango\/issues\/new\?\S+/.exec(res)![0];
    const params = new URL(link).searchParams;
    expect(params.get('template')).toBe('ai_report.md');
    expect(params.get('title')).toBe('[Bug] paginate() ignores orderBy');
    expect(params.get('body')).toContain('### Minimal reproduction');
  });

  it('redacts secrets but keeps package names and versions', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jsango-redact-'));
    try {
      const input = [
        'DATABASE_URL=postgres://app:hunter2@db.internal:5432/shop',
        'mongodb://admin:pw123@cluster0.example.net/app',
        'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456',
        'token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
        'ghp_abcdefghijklmnopqrstuvwxyz0123456789',
        'sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789',
        'AIzaSyA1234567890abcdefghijklmnopqrstuv',
        `${os.homedir()}/secret-project/file.ts`,
        'npm i jsango@1.4.0 and import from @jsango/auth',
      ].join('\n');
      const { text, count } = redact(input, cwd);
      for (const secret of [
        'hunter2',
        'pw123',
        'sk-ant-api03',
        'AIzaSyA123',
        'abcdefghijklmnopqrstuvwxyz123456',
        'eyJhbGci',
        'ghp_',
        os.homedir(),
      ]) {
        expect(text, secret).not.toContain(secret);
      }
      expect(text).toContain('jsango@1.4.0');
      expect(text).toContain('@jsango/auth');
      expect(count).toBeGreaterThanOrEqual(6);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('keeps the prefilled link short enough for GitHub', () => {
    const draft = draftIssue(
      { kind: 'docs', title: 'Long', summary: 'x'.repeat(20000) },
      os.tmpdir(),
      '1.4.0'
    );
    expect(draft.truncated).toBe(true);
    expect(draft.url.length).toBeLessThanOrEqual(7500);
  });

  it('reports when GitHub cannot be searched', async () => {
    const failing = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await findSimilarIssues('admin export crashes', { fetch: failing })).toEqual({
      ok: false,
      reason: 'offline',
    });
  });
});
