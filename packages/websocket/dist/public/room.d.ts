export declare class RoomManager {
    private readonly roomToConnections;
    private readonly connectionToRooms;
    /**
     * Adds a connection to a room.
     */
    join(connectionId: string, room: string, maxRoomsPerConnection?: number): void;
    /**
     * Removes a connection from a specific room.
     */
    leave(connectionId: string, room: string): boolean;
    /**
     * Removes a connection from all rooms (e.g. on disconnect).
     */
    leaveAll(connectionId: string): string[];
    /**
     * Returns members of a room.
     */
    getMembers(room: string): ReadonlySet<string>;
    /**
     * Returns rooms joined by a connection.
     */
    getRooms(connectionId: string): ReadonlySet<string>;
    /**
     * Checks if a connection is in a room.
     */
    hasMember(room: string, connectionId: string): boolean;
    /**
     * Total number of active rooms.
     */
    getRoomCount(): number;
    /**
     * Number of connections in a given room.
     */
    getConnectionCount(room: string): number;
}
//# sourceMappingURL=room.d.ts.map