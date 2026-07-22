import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
  }
  return socket;
}

export function emitAck<T = any>(event: string, payload: any): Promise<T> {
  return new Promise((resolve, reject) => {
    getSocket().emit(event, payload, (response: T & { ok: boolean; error?: string }) => {
      if (response && response.ok === false) reject(new Error(response.error || 'Erreur inconnue'));
      else resolve(response);
    });
  });
}
