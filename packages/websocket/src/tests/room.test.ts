import { describe, it, expect } from 'vitest';
import { RoomManager } from '../public/room.js';
import { WebSocketLimitExceededError } from '../public/errors.js';

describe('RoomManager', () => {
  it('allows connections to join and leave rooms', () => {
    const rooms = new RoomManager();

    rooms.join('conn-1', 'chat:general');
    rooms.join('conn-2', 'chat:general');
    rooms.join('conn-1', 'chat:announcements');

    expect(rooms.getMembers('chat:general')).toEqual(new Set(['conn-1', 'conn-2']));
    expect(rooms.getRooms('conn-1')).toEqual(new Set(['chat:general', 'chat:announcements']));
    expect(rooms.hasMember('chat:general', 'conn-1')).toBe(true);

    rooms.leave('conn-1', 'chat:general');
    expect(rooms.getMembers('chat:general')).toEqual(new Set(['conn-2']));
    expect(rooms.hasMember('chat:general', 'conn-1')).toBe(false);
  });

  it('enforces maximum rooms per connection limit', () => {
    const rooms = new RoomManager();

    rooms.join('conn-1', 'room-1', 2);
    rooms.join('conn-1', 'room-2', 2);

    expect(() => {
      rooms.join('conn-1', 'room-3', 2);
    }).toThrow(WebSocketLimitExceededError);
  });

  it('cleans up all rooms when connection disconnects (leaveAll)', () => {
    const rooms = new RoomManager();

    rooms.join('conn-1', 'room-a');
    rooms.join('conn-1', 'room-b');
    rooms.join('conn-2', 'room-a');

    const left = rooms.leaveAll('conn-1');
    expect(left).toContain('room-a');
    expect(left).toContain('room-b');

    expect(rooms.getRooms('conn-1').size).toBe(0);
    expect(rooms.getMembers('room-a')).toEqual(new Set(['conn-2']));
    expect(rooms.getMembers('room-b').size).toBe(0);
  });
});
