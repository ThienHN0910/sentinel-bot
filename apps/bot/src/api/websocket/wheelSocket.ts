import { WebSocket } from 'ws';
import { WheelSessionModel } from '../../models/WheelSession';

interface ClientEntry {
  ws: WebSocket;
  sessionId: string;
}

const rooms = new Map<string, Set<WebSocket>>();

export function registerWheelClient(sessionId: string, ws: WebSocket) {
  if (!rooms.has(sessionId)) {
    rooms.set(sessionId, new Set());
  }
  rooms.get(sessionId)!.add(ws);

  ws.on('close', () => {
    const room = rooms.get(sessionId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) rooms.delete(sessionId);
    }
  });
}

export function broadcastWheelEvent(sessionId: string, payload: object) {
  const room = rooms.get(sessionId);
  if (!room) return;
  const msg = JSON.stringify(payload);
  for (const client of room) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

export function getWheelRooms(): Map<string, Set<WebSocket>> {
  return rooms;
}
