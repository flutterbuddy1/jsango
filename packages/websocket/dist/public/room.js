import { WebSocketLimitExceededError } from './errors.js';
export class RoomManager {
    roomToConnections = new Map();
    connectionToRooms = new Map();
    /**
     * Adds a connection to a room.
     */
    join(connectionId, room, maxRoomsPerConnection) {
        let connRooms = this.connectionToRooms.get(connectionId);
        if (!connRooms) {
            connRooms = new Set();
            this.connectionToRooms.set(connectionId, connRooms);
        }
        if (maxRoomsPerConnection !== undefined &&
            !connRooms.has(room) &&
            connRooms.size >= maxRoomsPerConnection) {
            throw new WebSocketLimitExceededError({
                code: 'ERR_WS_MAX_ROOMS_PER_CONNECTION',
                message: `Connection ${connectionId} exceeded maximum room limit of ${maxRoomsPerConnection}.`,
                metadata: { connectionId, room, maxRooms: maxRoomsPerConnection },
            });
        }
        connRooms.add(room);
        let roomConns = this.roomToConnections.get(room);
        if (!roomConns) {
            roomConns = new Set();
            this.roomToConnections.set(room, roomConns);
        }
        roomConns.add(connectionId);
    }
    /**
     * Removes a connection from a specific room.
     */
    leave(connectionId, room) {
        const connRooms = this.connectionToRooms.get(connectionId);
        if (connRooms) {
            connRooms.delete(room);
            if (connRooms.size === 0) {
                this.connectionToRooms.delete(connectionId);
            }
        }
        const roomConns = this.roomToConnections.get(room);
        if (roomConns) {
            const removed = roomConns.delete(connectionId);
            if (roomConns.size === 0) {
                this.roomToConnections.delete(room);
            }
            return removed;
        }
        return false;
    }
    /**
     * Removes a connection from all rooms (e.g. on disconnect).
     */
    leaveAll(connectionId) {
        const connRooms = this.connectionToRooms.get(connectionId);
        if (!connRooms) {
            return [];
        }
        const leftRooms = [];
        for (const room of connRooms) {
            leftRooms.push(room);
            const roomConns = this.roomToConnections.get(room);
            if (roomConns) {
                roomConns.delete(connectionId);
                if (roomConns.size === 0) {
                    this.roomToConnections.delete(room);
                }
            }
        }
        this.connectionToRooms.delete(connectionId);
        return leftRooms;
    }
    /**
     * Returns members of a room.
     */
    getMembers(room) {
        return this.roomToConnections.get(room) ?? new Set();
    }
    /**
     * Returns rooms joined by a connection.
     */
    getRooms(connectionId) {
        return this.connectionToRooms.get(connectionId) ?? new Set();
    }
    /**
     * Checks if a connection is in a room.
     */
    hasMember(room, connectionId) {
        return this.roomToConnections.get(room)?.has(connectionId) ?? false;
    }
    /**
     * Total number of active rooms.
     */
    getRoomCount() {
        return this.roomToConnections.size;
    }
    /**
     * Number of connections in a given room.
     */
    getConnectionCount(room) {
        return this.roomToConnections.get(room)?.size ?? 0;
    }
}
//# sourceMappingURL=room.js.map