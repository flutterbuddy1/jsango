/**
 * In-memory local realtime transport for single-node deployments and tests.
 */
export class LocalTransport {
    subscribers = new Map();
    async publish(channel, message) {
        const handlers = this.subscribers.get(channel);
        if (!handlers || handlers.size === 0) {
            return;
        }
        for (const handler of handlers) {
            try {
                handler(message);
            }
            catch {
                // Individual handler error in local transport does not halt broadcast
            }
        }
    }
    subscribe(channel, handler) {
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
    unsubscribe(channel) {
        this.subscribers.delete(channel);
    }
    async close() {
        this.subscribers.clear();
    }
}
//# sourceMappingURL=transport.js.map