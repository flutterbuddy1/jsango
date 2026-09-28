import { randomUUID } from 'node:crypto';
import { WebSocketManager } from '../manager.js';
export class FakeWebSocketConnection {
    id;
    state = 'connected';
    identity;
    rooms = new Set();
    metadata = new Map();
    sentMessages = [];
    connectedAt = Date.now();
    bufferedAmount = 0;
    isAlive = true;
    closedCode;
    closedReason;
    constructor(options = {}) {
        this.id = options.id ?? randomUUID();
        this.identity = options.identity;
    }
    setIdentity(identity) {
        this.identity = identity;
    }
    setMetadata(key, value) {
        this.metadata.set(key, value);
    }
    addRoom(room) {
        this.rooms.add(room);
    }
    removeRoom(room) {
        this.rooms.delete(room);
    }
    async send(message) {
        this.sentMessages.push(message);
    }
    close(code, reason) {
        this.state = 'closed';
        this.closedCode = code;
        this.closedReason = reason;
    }
    terminate() {
        this.state = 'closed';
    }
    ping() {
        // No-op in fake
    }
    reset() {
        this.sentMessages.length = 0;
    }
}
export class FakeWebSocketServer {
    manager = new WebSocketManager({ allowAnonymous: true });
    isListening = false;
    async start() {
        this.isListening = true;
    }
    async close() {
        this.isListening = false;
        await this.manager.close();
    }
    get stats() {
        return this.manager.getStats();
    }
}
//# sourceMappingURL=fake.js.map