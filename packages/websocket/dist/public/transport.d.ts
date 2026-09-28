import type { IRealtimeTransport, WebSocketOutboundMessage } from './types.js';
/**
 * In-memory local realtime transport for single-node deployments and tests.
 */
export declare class LocalTransport implements IRealtimeTransport {
    private readonly subscribers;
    publish(channel: string, message: WebSocketOutboundMessage): Promise<void>;
    subscribe(channel: string, handler: (message: WebSocketOutboundMessage) => void): () => void;
    unsubscribe(channel: string): void;
    close(): Promise<void>;
}
//# sourceMappingURL=transport.d.ts.map