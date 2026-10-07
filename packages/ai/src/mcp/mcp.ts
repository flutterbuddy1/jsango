import type { ToolDefinition } from '../types.js';
import { tool } from '../tools/tool.js';
import { AiError, ToolError } from '../errors.js';

export interface McpServerOptions {
  name?: string | undefined;
  version?: string | undefined;
}

export class McpServer {
  public readonly name: string;
  public readonly version: string;
  private readonly tools = new Map<string, ToolDefinition>();

  constructor(options: McpServerOptions = {}) {
    this.name = options.name ?? 'jsango-mcp-server';
    this.version = options.version ?? '1.0.0';
  }

  public registerTool(toolDef: ToolDefinition): this {
    this.tools.set(toolDef.name, toolDef);
    return this;
  }

  public listTools(): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema ?? { type: 'object', properties: {} },
    }));
  }

  public async callTool(name: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    const t = this.tools.get(name);
    if (!t) {
      throw new Error(`MCP Tool '${name}' not found.`);
    }

    const res = await t.execute(args, {});
    return {
      content: [
        {
          type: 'text',
          text: typeof res === 'string' ? res : JSON.stringify(res),
        },
      ],
    };
  }

  /**
   * Handles one MCP JSON-RPC message (`initialize`, `ping`, `tools/list`, `tools/call`).
   * Returns null for notifications (messages without an id), which need no response.
   *
   * Serve it over HTTP with:
   * `app.post('/mcp', async (ctx) => (await server.handleJsonRpc(await ctx.request.json())) ?? HttpResponse.noContent())`
   */
  public async handleJsonRpc(payload: {
    jsonrpc?: '2.0';
    id?: string | number | null;
    method: string;
    params?: any;
  }): Promise<{ jsonrpc: '2.0'; id: string | number; result?: any; error?: any } | null> {
    const { id, method, params } = payload ?? ({} as { method: string });
    if (id === undefined || id === null) {
      return null; // notification, e.g. notifications/initialized
    }
    const ok = (result: unknown) => ({ jsonrpc: '2.0' as const, id, result });
    const fail = (code: number, message: string) => ({ jsonrpc: '2.0' as const, id, error: { code, message } });

    switch (method) {
      case 'initialize':
        return ok({
          protocolVersion: params?.protocolVersion ?? MCP_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: this.name, version: this.version },
        });
      case 'ping':
        return ok({});
      case 'tools/list':
        return ok({ tools: this.listTools() });
      case 'tools/call': {
        if (!params?.name || !this.tools.has(params.name)) {
          return fail(-32602, `Unknown tool '${String(params?.name)}'.`);
        }
        try {
          return ok(await this.callTool(params.name, params.arguments ?? {}));
        } catch (err) {
          // Tool failures are results the model can read, not protocol errors.
          return ok({
            content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
            isError: true,
          });
        }
      }
      default:
        return fail(-32601, `Method '${method}' not supported.`);
    }
  }
}

export const MCP_PROTOCOL_VERSION = '2025-03-26';

export interface McpConnectOptions {
  /** Extra HTTP headers, e.g. `{ Authorization: 'Bearer …' }`. */
  headers?: Record<string, string> | undefined;
  /** Custom fetch implementation (defaults to the global fetch). */
  fetch?: typeof fetch | undefined;
}

interface RpcMessage {
  readonly id?: unknown;
  readonly result?: Record<string, unknown>;
  readonly error?: { readonly message?: string };
}

interface RemoteTool {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema?: Record<string, unknown>;
}

/** A connection to a remote MCP server over HTTP (Streamable HTTP transport). */
export class McpConnection {
  private readonly url: string;
  private readonly headers: Record<string, string>;
  private readonly fetchFn: typeof fetch;
  private sessionId: string | undefined;
  private nextId = 1;
  public serverInfo: { name?: string; version?: string } = {};

  public constructor(url: string, options: McpConnectOptions = {}) {
    this.url = url;
    this.headers = options.headers ?? {};
    this.fetchFn = options.fetch ?? fetch;
  }

  private async rpc(method: string, params?: unknown, notification = false): Promise<Record<string, unknown> | undefined> {
    const id = notification ? undefined : this.nextId++;
    const res = await this.fetchFn(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(this.sessionId ? { 'Mcp-Session-Id': this.sessionId } : {}),
        ...this.headers,
      },
      body: JSON.stringify({ jsonrpc: '2.0', ...(id !== undefined ? { id } : {}), method, ...(params !== undefined ? { params } : {}) }),
    });
    this.sessionId = res.headers.get('mcp-session-id') ?? this.sessionId;
    if (!res.ok) {
      throw new AiError({ code: 'ERR_AI_MCP', message: `MCP ${method} failed: HTTP ${res.status} ${await res.text()}` });
    }
    if (notification || res.status === 202 || res.status === 204) return undefined;

    const body = await res.text();
    let message: RpcMessage | undefined;
    if ((res.headers.get('content-type') ?? '').includes('text/event-stream')) {
      // Find the JSON-RPC response for our id among the SSE `data:` lines.
      for (const line of body.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue;
        const parsed = JSON.parse(line.slice(5).trim()) as RpcMessage;
        if (parsed?.id === id) message = parsed;
      }
    } else {
      message = JSON.parse(body) as RpcMessage;
    }
    if (!message) throw new AiError({ code: 'ERR_AI_MCP', message: `MCP ${method}: no response for request ${id}.` });
    if (message.error) {
      throw new AiError({ code: 'ERR_AI_MCP', message: `MCP ${method} failed: ${message.error.message ?? JSON.stringify(message.error)}` });
    }
    return message.result;
  }

  /** Performs the MCP handshake. Called by McpClient.connect(). */
  public async initialize(): Promise<this> {
    const result = await this.rpc('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'jsango', version: '1' },
    });
    this.serverInfo = (result?.['serverInfo'] as McpConnection['serverInfo'] | undefined) ?? {};
    await this.rpc('notifications/initialized', undefined, true);
    return this;
  }

  /** Calls a remote tool and returns its text output (throws if the tool reported an error). */
  public async callTool(name: string, args: Record<string, unknown> = {}): Promise<string> {
    const result = await this.rpc('tools/call', { name, arguments: args });
    const content = (result?.['content'] ?? []) as Array<{ type: string; text?: string }>;
    const text = content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n');
    if (result?.['isError']) throw new ToolError(name, text || 'Remote MCP tool failed.');
    return text;
  }

  /** The remote server's tools as jsango tools, ready for `agent({ tools })`. */
  public async tools(): Promise<Record<string, ToolDefinition>> {
    const result = await this.rpc('tools/list', {});
    const map: Record<string, ToolDefinition> = {};
    for (const t of (result?.['tools'] ?? []) as RemoteTool[]) {
      map[t.name] = tool({
        name: t.name,
        description: t.description ?? '',
        inputSchema: t.inputSchema ?? { type: 'object', properties: {} },
        execute: (input: Record<string, unknown>) => this.callTool(t.name, input),
      });
    }
    return map;
  }
}

export class McpClient {
  /**
   * Connects to a remote MCP server and performs the handshake:
   * `const tools = await (await McpClient.connect('https://mcp.example.com/mcp')).tools();`
   */
  public static async connect(url: string, options?: McpConnectOptions): Promise<McpConnection> {
    return new McpConnection(url, options).initialize();
  }

  /** Wraps local functions as tools (for in-process MCP-style tool lists). */
  public static fromTools(toolsList: Array<{ name: string; description: string; inputSchema: any; handler: (args: any) => Promise<any> }>): Record<string, ToolDefinition> {
    const map: Record<string, ToolDefinition> = {};
    for (const item of toolsList) {
      map[item.name] = tool({
        name: item.name,
        description: item.description,
        inputSchema: item.inputSchema,
        execute: item.handler,
      });
    }
    return map;
  }
}

export const mcp = {
  server(options?: McpServerOptions): McpServer {
    return new McpServer(options);
  },
  client: McpClient,
  connect: McpClient.connect,
};
