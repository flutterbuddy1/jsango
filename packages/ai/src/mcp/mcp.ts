import type { ToolDefinition } from '../types.js';
import { tool } from '../tools/tool.js';

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

  public handleJsonRpc(payload: { id: string | number; method: string; params?: any }): Promise<{ jsonrpc: '2.0'; id: string | number; result?: any; error?: any }> {
    const { id, method, params } = payload;

    if (method === 'tools/list') {
      return Promise.resolve({
        jsonrpc: '2.0',
        id,
        result: { tools: this.listTools() },
      });
    }

    if (method === 'tools/call') {
      return this.callTool(params.name, params.arguments ?? {})
        .then((result) => ({ jsonrpc: '2.0' as const, id, result }))
        .catch((err) => ({
          jsonrpc: '2.0' as const,
          id,
          error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
        }));
    }

    return Promise.resolve({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method '${method}' not supported.` },
    });
  }
}

export class McpClient {
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
};
