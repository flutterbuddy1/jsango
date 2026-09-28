import type { ToolDefinition } from '../types.js';
export interface McpServerOptions {
    name?: string | undefined;
    version?: string | undefined;
}
export declare class McpServer {
    readonly name: string;
    readonly version: string;
    private readonly tools;
    constructor(options?: McpServerOptions);
    registerTool(toolDef: ToolDefinition): this;
    listTools(): Array<{
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
    }>;
    callTool(name: string, args: Record<string, unknown>): Promise<{
        content: Array<{
            type: 'text';
            text: string;
        }>;
    }>;
    handleJsonRpc(payload: {
        id: string | number;
        method: string;
        params?: any;
    }): Promise<{
        jsonrpc: '2.0';
        id: string | number;
        result?: any;
        error?: any;
    }>;
}
export declare class McpClient {
    static fromTools(toolsList: Array<{
        name: string;
        description: string;
        inputSchema: any;
        handler: (args: any) => Promise<any>;
    }>): Record<string, ToolDefinition>;
}
export declare const mcp: {
    server(options?: McpServerOptions): McpServer;
    client: typeof McpClient;
};
//# sourceMappingURL=mcp.d.ts.map