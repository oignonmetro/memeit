import type { Server } from 'socket.io';
import { Room } from './Room.js';
import { generateRoomCode } from '../utils/code.js';
import type { RoomSettings } from '../types.js';

const EMPTY_ROOM_GRACE_MS = 60_000;
const STALE_ROOM_MS = 10 * 60_000;

export class RoomManager {
  private rooms = new Map<string, Room>();
  private socketRoomCode = new Map<string, string>();

  constructor(private io: Server) {
    setInterval(() => this.cleanupStale(), 5 * 60_000).unref?.();
  }

  createRoom(settings: Partial<RoomSettings> = {}): Room {
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();
    const room = new Room(code, this.io, settings);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get((code || '').toUpperCase());
  }

  registerSocket(socketId: string, code: string) {
    this.socketRoomCode.set(socketId, code.toUpperCase());
  }

  getRoomForSocket(socketId: string): Room | undefined {
    const code = this.socketRoomCode.get(socketId);
    return code ? this.rooms.get(code) : undefined;
  }

  handleDisconnect(socketId: string) {
    const room = this.getRoomForSocket(socketId);
    this.socketRoomCode.delete(socketId);
    if (!room) return;
    room.disconnectSocket(socketId);
    if (room.isEmpty()) {
      setTimeout(() => {
        if (room.isEmpty()) {
          room.destroy();
          this.rooms.delete(room.code);
        }
      }, EMPTY_ROOM_GRACE_MS);
    }
  }

  private cleanupStale() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (room.isEmpty() && now - room.lastActivity > STALE_ROOM_MS) {
        room.destroy();
        this.rooms.delete(code);
      }
    }
  }
}
