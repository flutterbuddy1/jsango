import type { ILogger } from '@jsango/core';
import type { WebSocketConnection } from './connection.js';
import type { HeartbeatConfig } from './types.js';
export declare class HeartbeatManager {
    private readonly connections;
    private readonly pingIntervalMs;
    private readonly logger;
    private timer?;
    private isRunning;
    constructor(config?: HeartbeatConfig, logger?: ILogger);
    register(connection: WebSocketConnection): void;
    unregister(connectionId: string): void;
    onPong(connectionId: string): void;
    start(): void;
    stop(): void;
    private checkConnections;
}
//# sourceMappingURL=heartbeat.d.ts.map