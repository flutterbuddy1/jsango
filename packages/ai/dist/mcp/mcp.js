import { tool } from '../tools/tool.js';
export class McpServer {
    name;
    version;
    tools = new Map();
    constructor(options = {}) {
        this.name = options.name ?? 'jsango-mcp-server';
        this.version = options.version ?? '1.0.0';
    }
    registerTool(toolDef) {
        this.tools.set(toolDef.name, toolDef);
        return this;
    }
    listTools() {
        return Array.from(this.tools.values()).map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema ?? { type: 'object', properties: {} },
        }));
    }
    async callTool(name, args) {
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
    handleJsonRpc(payload) {
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
                .then((result) => ({ jsonrpc: '2.0', id, result }))
                .catch((err) => ({
                jsonrpc: '2.0',
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
    static fromTools(toolsList) {
        const map = {};
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
    server(options) {
        return new McpServer(options);
    },
    client: McpClient,
};
//# sourceMappingURL=mcp.js.map