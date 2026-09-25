import { WebSocketLimitExceededError } from './errors.js';

export class RoomManager {
  private readonly roomToConnections = new Map<string, Set<string>>();
  private readonly connectionToRooms = new Map<string, Set<string>>();

  /**
   * Adds a connection to a room.
   */
  public join(connectionId: string, room: string, maxRoomsPerConnection?: number): void {
    let connRooms = this.connectionToRooms.get(connectionId);
    if (!connRooms) {
      connRooms = new Set();
      this.connectionToRooms.set(connectionId, connRooms);
    }

    if (
      maxRoomsPerConnection !== undefined &&
      !connRooms.has(room) &&
      connRooms.size >= maxRoomsPerConnection
    ) {
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
  public leave(connectionId: string, room: string): boolean {
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
  public leaveAll(connectionId: string): string[] {
    const connRooms = this.connectionToRooms.get(connectionId);
    if (!connRooms) {
      return [];
    }

    const leftRooms: string[] = [];
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
  public getMembers(room: string): ReadonlySet<string> {
    return this.roomToConnections.get(room) ?? new Set();
  }

  /**
   * Returns rooms joined by a connection.
   */
  public getRooms(connectionId: string): ReadonlySet<string> {
    return this.connectionToRooms.get(connectionId) ?? new Set();
  }

  /**
   * Checks if a connection is in a room.
   */
  public hasMember(room: string, connectionId: string): boolean {
    return this.roomToConnections.get(room)?.has(connectionId) ?? false;
  }

  /**
   * Total number of active rooms.
   */
  public getRoomCount(): number {
    return this.roomToConnections.size;
  }

  /**
   * Number of connections in a given room.
   */
  public getConnectionCount(room: string): number {
    return this.roomToConnections.get(room)?.size ?? 0;
  }
}
