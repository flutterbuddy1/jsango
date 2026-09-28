import { type Server } from 'node:http';
import type { IHttpServer, HttpServerHandler, ServerAddress } from '../../public/server.js';
import type { ILogger } from '@jsango/core';
export interface NodeHttpServerOptions {
    readonly logger?: ILogger | undefined;
    readonly isProduction?: boolean | undefined;
    readonly maxBodySize?: number | undefined;
}
export declare class NodeHttpServer implements IHttpServer {
    private readonly handler;
    private readonly options;
    private readonly logger;
    private server;
    private activeRequests;
    private readonly activeControllers;
    constructor(handler: HttpServerHandler, options?: NodeHttpServerOptions);
    get isListening(): boolean;
    getUnderlyingServer(): Server | null;
    get address(): ServerAddress | null;
    listen(port?: number, host?: string): Promise<ServerAddress>;
    close(timeoutMs?: number): Promise<void>;
    private handleNodeRequest;
    private translateRequest;
    private sendResponse;
}
export declare function createNodeHttpServer(handler: HttpServerHandler, options?: NodeHttpServerOptions): IHttpServer;
//# sourceMappingURL=node-server.d.ts.map