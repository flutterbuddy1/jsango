/**
 * Behaviour of APIs that the documentation promises (beyond type-checking the snippets).
 */
import * as http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  agent,
  workflow,
  knowledge,
  evaluate,
  tool,
  FakeLlmProvider,
  InMemoryMemoryStore,
  DatabaseMemoryStore,
  McpServer,
  McpClient,
  ToolExecutor,
  ToolError,
} from '../packages/ai/dist/index.js';
import { MetricRegistry } from '../packages/observability/dist/index.js';
import { DatabaseManager } from '../packages/database/dist/index.js';
import { createApp, defineModel, fields, setDatabaseManager } from '../packages/jsango/dist/index.js';
import { clearDatabaseManager } from '../packages/orm/dist/index.js';

describe('workflow', () => {
  it('run() executes steps, parallel groups and boolean branches', async () => {
    const pipeline = workflow('review')
      .step('draft', async (input: string) => `draft of ${input}`)
      .parallel('checks', { length: async (_i, s) => String(s['draft']).length })
      .branch('review', (s) => s['length'] > 5, {
        true: async () => 'legal',
        false: async () => 'fast',
      });
    const result = await pipeline.run({ input: 'earnings' });
    expect(result.status).toBe('completed');
    expect(result.state['draft']).toBe('draft of earnings');
    expect(result.state['review']).toBe('legal');
  });
});

describe('knowledge', () => {
  it('search() returns scored matches above minScore', async () => {
    const kb = knowledge('kb', { provider: new FakeLlmProvider() });
    await kb.ingest('JSango is a TypeScript backend framework.');
    await kb.ingest([{ id: 'x', content: 'Bananas are yellow.' }]);
    const all = await kb.search('JSango is a TypeScript backend framework.', { limit: 5 });
    expect(all[0]?.document.content).toContain('JSango');
    expect(all[0]?.score).toBeGreaterThan(0.99);
    const strict = await kb.search('JSango is a TypeScript backend framework.', { minScore: 0.999 });
    expect(strict.every((m) => m.score >= 0.999)).toBe(true);
  });
});

describe('agent memory', () => {
  it('isolates conversations per tenant and user', async () => {
    const memory = new InMemoryMemoryStore();
    const fake = new FakeLlmProvider('ok');
    const bot = agent({ provider: fake, memory });
    expect(bot.name).toBe('agent');

    await bot.run({ input: 'secret of alice', context: { user: { id: 'alice' }, tenantId: 'acme' } });
    await bot.run({ input: 'hello from bob', context: { user: { id: 'bob' }, tenantId: 'acme' } });

    const bobPrompt = fake.callHistory[1]!.messages!.map((m) => m.content).join('\n');
    expect(bobPrompt).not.toContain('secret of alice');
    expect((await memory.get('t:acme|u:alice|default')).map((m) => m.content)).toContain('secret of alice');
  });

  async function persistedRoundTrip(db: DatabaseManager) {
    const store = new DatabaseMemoryStore({ connection: db, maxMessages: 3 });
    await store.set('c1', [{ role: 'user', content: 'a' }]);
    await store.set('c1', [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
      { role: 'assistant', content: 'd' },
    ]);
    expect((await store.get('c1')).map((m) => m.content)).toEqual(['b', 'c', 'd']);
    // a new store instance (e.g. after a restart) sees the same data
    expect((await new DatabaseMemoryStore({ connection: db }).get('c1')).length).toBe(3);
    await store.clear('c1');
    expect(await store.get('c1')).toEqual([]);
  }

  it('DatabaseMemoryStore persists in SQLite', async () => {
    const db = new DatabaseManager({ default: 'default', connections: { default: { driver: 'sqlite', filename: ':memory:' } } });
    try {
      await persistedRoundTrip(db);
    } finally {
      await db.close();
    }
  });

  let mongod: MongoMemoryServer;
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
  }, 120_000);
  afterAll(async () => {
    await mongod?.stop();
  });

  it('DatabaseMemoryStore persists in MongoDB', async () => {
    const db = new DatabaseManager({ default: 'default', connections: { default: { url: `${mongod.getUri()}mem` } } });
    try {
      await persistedRoundTrip(db);
    } finally {
      await db.close();
    }
  });

  it('requires a database connection', () => {
    expect(() => new DatabaseMemoryStore({} as never)).toThrow(/requires your DatabaseManager/);
  });
});

describe('tool permissions', () => {
  const del = tool({ name: 'del', description: 'delete', permissions: ['users.delete'], execute: async () => 'deleted' });

  it('accepts a permissions array, denies everything else', async () => {
    const ok = await ToolExecutor.execute({ tool: del, arguments: {}, context: { user: { id: 1, permissions: ['users.delete'] } } });
    expect(ok.output).toBe('deleted');
    await expect(ToolExecutor.execute({ tool: del, arguments: {}, context: { user: { id: 2 } } })).rejects.toThrow(ToolError);
    await expect(ToolExecutor.execute({ tool: del, arguments: {}, context: { user: { id: 3, permissions: ['x'] } } })).rejects.toThrow(/Forbidden/);
    await expect(ToolExecutor.execute({ tool: del, arguments: {}, context: {} })).rejects.toThrow(/Unauthorized/);
  });
});

describe('evaluate', () => {
  it('scores each case independently', async () => {
    const report = await evaluate('suite', [
      { input: 'a', expected: 'nope' },
      { input: 'b', expected: 'echo b' },
      { input: 'c', expected: /echo/ },
    ], async (input) => `echo ${input}`);
    expect(report.passed).toBe(false);
    expect(report.score).toBeCloseTo(66.67, 1);
    expect(report.errors).toHaveLength(1);
  });
});

describe('MCP', () => {
  const server = new McpServer({ name: 'test-tools', version: '2.0.0' })
    .registerTool(tool({ name: 'add', description: 'add', execute: async ({ a, b }: { a: number; b: number }) => a + b }))
    .registerTool(tool({ name: 'boom', description: 'fails', execute: async () => { throw new Error('kaput'); } }));

  it('implements the MCP handshake and tool calls', async () => {
    const init = await server.handleJsonRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
    expect(init?.result).toMatchObject({ serverInfo: { name: 'test-tools', version: '2.0.0' }, capabilities: { tools: {} } });
    expect(await server.handleJsonRpc({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull();
    const failed = await server.handleJsonRpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'boom' } });
    expect(failed?.result).toMatchObject({ isError: true, content: [{ type: 'text', text: 'kaput' }] });
    const unknown = await server.handleJsonRpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'nope' } });
    expect(unknown?.error?.code).toBe(-32602);
  });

  it.each(['json', 'sse'] as const)('McpClient talks to a remote server (%s responses)', async (mode) => {
    let sessionSeen: string | undefined;
    const httpServer = http.createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      sessionSeen = (req.headers['mcp-session-id'] as string | undefined) ?? sessionSeen;
      const reply = await server.handleJsonRpc(JSON.parse(body));
      res.setHeader('Mcp-Session-Id', 'sess-1');
      if (!reply) {
        res.statusCode = 202;
        res.end();
      } else if (mode === 'sse') {
        res.setHeader('Content-Type', 'text/event-stream');
        res.end(`event: message\ndata: ${JSON.stringify(reply)}\n\n`);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(reply));
      }
    });
    await new Promise<void>((r) => httpServer.listen(0, '127.0.0.1', r));
    const { port } = httpServer.address() as { port: number };
    try {
      const remote = await McpClient.connect(`http://127.0.0.1:${port}/mcp`);
      expect(remote.serverInfo.name).toBe('test-tools');
      const tools = await remote.tools();
      expect(Object.keys(tools).sort()).toEqual(['add', 'boom']);
      expect(await tools['add']!.execute({ a: 2, b: 3 }, {})).toBe('5');
      await expect(remote.callTool('boom')).rejects.toThrow(/kaput/);
      expect(sessionSeen).toBe('sess-1');
    } finally {
      await new Promise((r) => httpServer.close(r));
    }
  });
});

describe('metrics', () => {
  it('exports the Prometheus text format', () => {
    const metrics = new MetricRegistry();
    metrics.counter('http_requests_total', 'HTTP requests', ['route']).inc(2, { route: '/a"b' });
    metrics.gauge('queue_depth', 'Jobs waiting').set(7);
    metrics.histogram('latency_seconds', 'Latency', [0.1, 1]).observe(0.5);
    const text = metrics.toPrometheus();
    expect(text).toContain('# TYPE http_requests_total counter');
    expect(text).toContain('http_requests_total{route="/a\\"b"} 2');
    expect(text).toContain('queue_depth 7');
    expect(text).toContain('latency_seconds_bucket{le="0.1"} 0');
    expect(text).toContain('latency_seconds_bucket{le="1"} 1');
    expect(text).toContain('latency_seconds_bucket{le="+Inf"} 1');
    expect(text).toContain('latency_seconds_count 1');
  });
});

describe('app.crud filters', () => {
  it('filters by filterFields and keeps search inside the filter', async () => {
    const db = new DatabaseManager({ default: 'default', connections: { default: { driver: 'sqlite', filename: ':memory:' } } });
    setDatabaseManager(db);
    const Article = defineModel('CrudArticle', {
      id: fields.id(),
      title: fields.string(),
      published: fields.boolean({ defaultValue: false }),
    }, { table: 'crud_articles', registry: false });
    await db.query('CREATE TABLE crud_articles (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, published INTEGER)');
    await Article.bulkCreate([
      { title: 'jsango intro', published: true },
      { title: 'jsango draft', published: false },
      { title: 'other', published: true },
    ]);

    const app = createApp();
    app.crud('/articles', Article, { searchFields: ['title'], filterFields: ['published'] });
    const server = await app.listen(0, '127.0.0.1');
    try {
      const base = `http://127.0.0.1:${server.address!.port}/articles`;
      const pub = (await (await fetch(`${base}?published=true`)).json()) as { items: { title: string }[] };
      expect(pub.items.map((a) => a.title).sort()).toEqual(['jsango intro', 'other']);
      const both = (await (await fetch(`${base}?published=true&search=jsango`)).json()) as { items: { title: string }[] };
      expect(both.items.map((a) => a.title)).toEqual(['jsango intro']);
    } finally {
      await server.close();
      clearDatabaseManager();
      await db.close();
    }
  });
});
