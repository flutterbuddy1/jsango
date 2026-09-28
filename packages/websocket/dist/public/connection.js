import { randomUUID } from 'node:crypto';
import { WebSocketConnectionError, WebSocketLimitExceededError } from './errors.js';
export class WebSocketConnection {
    id;
    connectedAt = Date.now();
    isAlive = true;
    socket;
    maxBufferedAmountBytes;
    _identity;
    _rooms = new Set();
    _metadata = new Map();
    _state = 'connected';
    constructor(options) {
        this.id = options.id ?? randomUUID();
        this.socket = options.socket;
        this._identity = options.identity;
        this.maxBufferedAmountBytes = options.maxBufferedAmountBytes;
    }
    get state() {
        return this._state;
    }
    get identity() {
        return this._identity;
    }
    get rooms() {
        return this._rooms;
    }
    get metadata() {
        return this._metadata;
    }
    get bufferedAmount() {
        return this.socket.bufferedAmount ?? 0;
    }
    setIdentity(identity) {
        this._identity = identity;
    }
    setMetadata(key, value) {
        this._metadata.set(key, value);
    }
    addRoom(room) {
        this._rooms.add(room);
    }
    removeRoom(room) {
        this._rooms.delete(room);
    }
    markClosed() {
        this._state = 'closed';
    }
    async send(message) {
        if (this._state !== 'connected') {
            throw new WebSocketConnectionError({
                code: 'ERR_WS_NOT_CONNECTED',
                message: `Cannot send message to connection ${this.id}; connection state is ${this._state}.`,
            });
        }
        if (this.maxBufferedAmountBytes !== undefined &&
            this.bufferedAmount > this.maxBufferedAmountBytes) {
            throw new WebSocketLimitExceededError({
                code: 'ERR_WS_BACKPRESSURE_LIMIT',
                message: `Connection ${this.id} exceeded buffered amount limit (${this.bufferedAmount} > ${this.maxBufferedAmountBytes} bytes).`,
            });
        }
        const data = JSON.stringify(message);
        return new Promise((resolve, reject) => {
            try {
                this.socket.send(data, (err) => {
                    if (err) {
                        reject(new WebSocketConnectionError({
                            code: 'ERR_WS_SEND_FAILED',
                            message: `Failed to send WebSocket message to connection ${this.id}: ${err.message}`,
                            cause: err,
                        }));
                    }
                    else {
                        resolve();
                    }
                });
            }
            catch (err) {
                reject(new WebSocketConnectionError({
                    code: 'ERR_WS_SEND_FAILED',
                    message: `Exception sending WebSocket message: ${err instanceof Error ? err.message : String(err)}`,
                    cause: err,
                }));
            }
        });
    }
    close(code, reason) {
        this._state = 'closing';
        try {
            this.socket.close(code, reason);
        }
        catch {
            // Ignored if socket is already closing/closed
        }
    }
    terminate() {
        this._state = 'closed';
        try {
            if (typeof this.socket.terminate === 'function') {
                this.socket.terminate();
            }
            else {
                this.socket.close(1006, 'Abnormal closure');
            }
        }
        catch {
            // Ignored
        }
    }
    ping() {
        try {
            if (typeof this.socket.ping === 'function') {
                this.socket.ping();
            }
        }
        catch {
            // Ignored
        }
    }
}
//# sourceMappingURL=connection.js.map