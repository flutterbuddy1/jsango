import type { IRealtimeTransport, WebSocketOutboundMessage } from './types.js';

/**
 * In-memory local realtime transport for single-node deployments and tests.
 */
export class LocalTransport implements IRealtimeTransport {
  private readonly subscribers = new Map<
    string,
    Set<(message: WebSocketOutboundMessage) => void>
  >();

  public async publish(channel: string, message: WebSocketOutboundMessage): Promise<void> {
    const handlers = this.subscribers.get(channel);
    if (!handlers || handlers.size === 0) {
      return;
    }

    for (const handler of handlers) {
      try {
        handler(message);
      } catch {
        // Individual handler error in local transport does not halt broadcast
      }
    }
  }

  public subscribe(
    channel: string,
    handler: (message: WebSocketOutboundMessage) => void
  ): () => void {
    let handlers = this.subscribers.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.subscribers.set(channel, handlers);
    }
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscribers.delete(channel);
      }
    };
  }

  public unsubscribe(channel: string): void {
    this.subscribers.delete(channel);
  }

  public async close(): Promise<void> {
    this.subscribers.clear();
  }
}
