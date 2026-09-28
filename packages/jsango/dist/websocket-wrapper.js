import { WebSocketServer as WSServer, WebSocket as WSWebSocket } from 'ws';
export class SimpleWebSocketConnection {
    id;
    user;
    ws;
    hub;
    eventHandlers = new Map();
    constructor(id, ws, hub, user) {
        this.id = id;
        this.ws = ws;
        this.hub = hub;
        this.user = user;
        this.ws.on('message', (raw) => {
            let data;
            try {
                data = JSON.parse(raw.toString());
            }
            catch {
                data = raw.toString();
            }
            const handlers = this.eventHandlers.get('message');
            if (handlers) {
                for (const handler of handlers) {
                    try {
                        void handler(data);
                    }
                    catch (err) {
                        this.emit('error', err instanceof Error ? err : new Error(String(err)));
                    }
                }
            }
        });
        this.ws.on('close', (code, reason) => {
            this.hub.removeConnection(this);
            const handlers = this.eventHandlers.get('close');
            if (handlers) {
                for (const handler of handlers) {
                    try {
                        void handler(code, reason.toString());
                    }
                    catch (err) {
                        this.emit('error', err instanceof Error ? err : new Error(String(err)));
                    }
                }
            }
        });
        this.ws.on('error', (err) => {
            this.emit('error', err);
        });
    }
    async send(data) {
        if (this.ws.readyState !== WSWebSocket.OPEN) {
            return;
        }
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        return new Promise((resolve, reject) => {
            this.ws.send(payload, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async broadcast(data) {
        await this.hub.broadcast(data, this.id);
    }
    join(room) {
        this.hub.joinRoom(this.id, room);
    }
    leave(room) {
        this.hub.leaveRoom(this.id, room);
    }
    to(room) {
        return {
            send: async (data) => {
                await this.hub.sendToRoom(room, data);
            },
        };
    }
    on(event, handler) {
        let handlers = this.eventHandlers.get(event);
        if (!handlers) {
            handlers = new Set();
            this.eventHandlers.set(event, handlers);
        }
        handlers.add(handler);
        return this;
    }
    emit(event, ...args) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    void handler(...args);
                }
                catch {
                    // ignore error inside error handler
                }
            }
        }
    }
    close(code = 1000, reason = 'Normal closure') {
        this.ws.close(code, reason);
    }
}
export class WebSocketHub {
    connections = new Map();
    rooms = new Map();
    addConnection(conn) {
        this.connections.set(conn.id, conn);
    }
    removeConnection(conn) {
        this.connections.delete(conn.id);
        for (const [room, members] of this.rooms.entries()) {
            members.delete(conn.id);
            if (members.size === 0) {
                this.rooms.delete(room);
            }
        }
    }
    joinRoom(connId, room) {
        let members = this.rooms.get(room);
        if (!members) {
            members = new Set();
            this.rooms.set(room, members);
        }
        members.add(connId);
    }
    leaveRoom(connId, room) {
        const members = this.rooms.get(room);
        if (members) {
            members.delete(connId);
            if (members.size === 0) {
                this.rooms.delete(room);
            }
        }
    }
    async broadcast(data, excludeConnId) {
        const promises = [];
        for (const conn of this.connections.values()) {
            if (conn.id !== excludeConnId) {
                promises.push(conn.send(data).catch(() => { }));
            }
        }
        await Promise.allSettled(promises);
    }
    async sendToRoom(room, data) {
        const members = this.rooms.get(room);
        if (!members)
            return;
        const promises = [];
        for (const connId of members) {
            const conn = this.connections.get(connId);
            if (conn) {
                promises.push(conn.send(data).catch(() => { }));
            }
        }
        await Promise.allSettled(promises);
    }
}
export class WebSocketEndpointManager {
    routes = new Map();
    wss;
    isListening = false;
    register(path, callback) {
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        this.routes.set(normalizedPath, { callback, hub: new WebSocketHub() });
    }
    hasRoutes() {
        return this.routes.size > 0;
    }
    getRoutes() {
        return Array.from(this.routes.keys());
    }
    attach(server) {
        if (this.isListening)
            return;
        this.wss = new WSServer({ noServer: true });
        server.on('upgrade', (req, socket, head) => {
            const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
            const route = this.routes.get(url.pathname);
            if (!route) {
                return; // Not registered on our ws routes
            }
            this.wss.handleUpgrade(req, socket, head, (ws) => {
                const id = 'ws_' + Math.random().toString(36).slice(2, 9);
                const simpleConn = new SimpleWebSocketConnection(id, ws, route.hub);
                route.hub.addConnection(simpleConn);
                if (typeof route.callback === 'function') {
                    void route.callback(simpleConn);
                }
                else if (typeof route.callback === 'object') {
                    const handlers = route.callback;
                    if (handlers.open) {
                        void handlers.open(simpleConn);
                    }
                    if (handlers.message) {
                        simpleConn.on('message', (msg) => handlers.message(simpleConn, msg));
                    }
                    if (handlers.close) {
                        simpleConn.on('close', (code, reason) => handlers.close(simpleConn, code, reason));
                    }
                    if (handlers.error) {
                        simpleConn.on('error', (err) => handlers.error(simpleConn, err));
                    }
                }
            });
        });
        this.isListening = true;
    }
    async close() {
        if (this.wss) {
            await new Promise((resolve) => {
                this.wss.close(() => resolve());
            });
        }
    }
}
//# sourceMappingURL=websocket-wrapper.js.map