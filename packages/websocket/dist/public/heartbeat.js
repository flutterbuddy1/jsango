import { NoopLogger } from '@jsango/core';
export class HeartbeatManager {
    connections = new Map();
    pingIntervalMs;
    logger;
    timer;
    isRunning = false;
    constructor(config = {}, logger = new NoopLogger()) {
        this.pingIntervalMs = config.pingIntervalMs ?? 30000;
        this.logger = logger;
    }
    register(connection) {
        this.connections.set(connection.id, connection);
    }
    unregister(connectionId) {
        this.connections.delete(connectionId);
    }
    onPong(connectionId) {
        const conn = this.connections.get(connectionId);
        if (conn) {
            conn.isAlive = true;
        }
    }
    start() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        this.timer = setInterval(() => {
            this.checkConnections();
        }, this.pingIntervalMs);
        // Unref timer so Node process is not kept alive solely by the ping timer
        if (typeof this.timer.unref === 'function') {
            this.timer.unref();
        }
    }
    stop() {
        this.isRunning = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
        this.connections.clear();
    }
    checkConnections() {
        for (const [id, conn] of this.connections) {
            if (!conn.isAlive) {
                this.logger.warn(`Connection ${id} failed heartbeat response; terminating dead connection.`);
                this.connections.delete(id);
                conn.terminate();
            }
            else {
                conn.isAlive = false;
                conn.ping();
            }
        }
    }
}
//# sourceMappingURL=heartbeat.js.map