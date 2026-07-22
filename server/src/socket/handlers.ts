import type { Server, Socket } from 'socket.io';
import { RoomManager } from '../rooms/RoomManager.js';
import { EVENTS } from './events.js';
import { DEFAULT_SETTINGS, MAX_PLAYERS } from '../types.js';

const MAX_UPLOAD_DATA_URL_LENGTH = 1_800_000; // ~1.3MB binary, base64-inflated

type Ack = (response: any) => void;

function roomChannel(code: string) {
  return `room:${code}`;
}

function err(message: string) {
  return { ok: false, error: message };
}

export function registerSocketHandlers(io: Server, socket: Socket, manager: RoomManager) {
  socket.on(EVENTS.CREATE_ROOM, (payload: { nickname?: string; settings?: any }, ack?: Ack) => {
    const nickname = String(payload?.nickname || '').trim().slice(0, 20) || 'Hôte';
    const settings = sanitizeSettings(payload?.settings);
    const room = manager.createRoom(settings);
    const player = room.addPlayer(nickname, socket.id);
    socket.join(roomChannel(room.code));
    manager.registerSocket(socket.id, room.code);
    room.broadcastRoomUpdate();
    ack?.({ ok: true, code: room.code, player: publicPlayer(player), room: room.snapshot() });
  });

  socket.on(EVENTS.JOIN_ROOM, (payload: { code?: string; nickname?: string }, ack?: Ack) => {
    const room = manager.getRoom(String(payload?.code || ''));
    if (!room) return ack?.(err('Salle introuvable.'));
    if (room.phase !== 'lobby') return ack?.(err('La partie a déjà commencé.'));
    if (room.players.size >= MAX_PLAYERS) return ack?.(err('Salle complète.'));
    const nickname = String(payload?.nickname || '').trim().slice(0, 20) || 'Joueur';
    const player = room.addPlayer(nickname, socket.id);
    socket.join(roomChannel(room.code));
    manager.registerSocket(socket.id, room.code);
    room.broadcastRoomUpdate();
    ack?.({ ok: true, code: room.code, player: publicPlayer(player), room: room.snapshot() });
  });

  socket.on(EVENTS.JOIN_TV, (payload: { code?: string }, ack?: Ack) => {
    const room = manager.getRoom(String(payload?.code || ''));
    if (!room) return ack?.(err('Salle introuvable.'));
    room.addViewer(socket.id);
    socket.join(roomChannel(room.code));
    manager.registerSocket(socket.id, room.code);
    ack?.({ ok: true, code: room.code, room: room.snapshot() });
    room.sendResumePayload(socket.id);
  });

  socket.on(EVENTS.REJOIN_ROOM, (payload: { code?: string; playerId?: string; token?: string }, ack?: Ack) => {
    const room = manager.getRoom(String(payload?.code || ''));
    if (!room) return ack?.(err('Salle introuvable.'));
    const player = room.rejoinPlayer(String(payload?.playerId || ''), String(payload?.token || ''), socket.id);
    if (!player) return ack?.(err('Impossible de te reconnecter à cette salle.'));
    socket.join(roomChannel(room.code));
    manager.registerSocket(socket.id, room.code);
    room.broadcastRoomUpdate();
    ack?.({ ok: true, code: room.code, player: publicPlayer(player), room: room.snapshot() });
    room.sendResumePayload(socket.id);
  });

  socket.on(EVENTS.START_GAME, (_payload: any, ack?: Ack) => {
    const room = manager.getRoomForSocket(socket.id);
    if (!room) return ack?.(err('Salle introuvable.'));
    const player = room.findPlayerBySocket(socket.id);
    if (!player?.isHost) return ack?.(err('Seul l\'hôte peut démarrer la partie.'));
    if (!room.canStart()) return ack?.(err('Il faut au moins 2 joueurs connectés.'));
    room.startGame();
    ack?.({ ok: true });
  });

  socket.on(EVENTS.UPLOAD_TEMPLATE, (payload: { dataUrl?: string }, ack?: Ack) => {
    const room = manager.getRoomForSocket(socket.id);
    if (!room) return ack?.(err('Salle introuvable.'));
    const dataUrl = String(payload?.dataUrl || '');
    if (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(dataUrl)) return ack?.(err('Image invalide.'));
    if (dataUrl.length > MAX_UPLOAD_DATA_URL_LENGTH) return ack?.(err('Image trop volumineuse.'));
    const template = room.addCustomTemplate(dataUrl);
    if (!template) return ack?.(err('Impossible d\'ajouter ce template maintenant.'));
    room.broadcastRoomUpdate();
    ack?.({ ok: true, template: { id: template.id, name: template.name, source: template.source } });
  });

  socket.on(EVENTS.SUBMIT_MEME, (payload: { templateId?: string; layers?: any[] }, ack?: Ack) => {
    const room = manager.getRoomForSocket(socket.id);
    if (!room) return ack?.(err('Salle introuvable.'));
    const player = room.findPlayerBySocket(socket.id);
    if (!player) return ack?.(err('Joueur inconnu.'));
    const result = room.submitMeme(player.id, String(payload?.templateId || ''), payload?.layers || []);
    ack?.(result);
  });

  socket.on(EVENTS.CAST_VOTE, (payload: { memeId?: string; thumbsUp?: boolean }, ack?: Ack) => {
    const room = manager.getRoomForSocket(socket.id);
    if (!room) return ack?.(err('Salle introuvable.'));
    const player = room.findPlayerBySocket(socket.id);
    if (!player) return ack?.(err('Joueur inconnu.'));
    const result = room.castVote(player.id, String(payload?.memeId || ''), Boolean(payload?.thumbsUp));
    ack?.(result);
  });

  socket.on(EVENTS.LEAVE_ROOM, (_payload: any, ack?: Ack) => {
    manager.handleDisconnect(socket.id);
    socket.rooms.forEach((r) => socket.leave(r));
    ack?.({ ok: true });
  });

  socket.on('disconnect', () => {
    manager.handleDisconnect(socket.id);
  });
}

function publicPlayer(p: { id: string; nickname: string; score: number; connected: boolean; isHost: boolean; token: string }) {
  return { id: p.id, nickname: p.nickname, score: p.score, connected: p.connected, isHost: p.isHost, token: p.token };
}

function sanitizeSettings(input: any) {
  if (!input || typeof input !== 'object') return {};
  const out: any = {};
  if (Number.isFinite(input.rounds)) out.rounds = Math.min(10, Math.max(1, Math.round(input.rounds)));
  if (Number.isFinite(input.captionTimeSec)) out.captionTimeSec = Math.min(180, Math.max(20, Math.round(input.captionTimeSec)));
  if (Number.isFinite(input.voteTimeSec)) out.voteTimeSec = Math.min(30, Math.max(4, Math.round(input.voteTimeSec)));
  if (['library', 'upload', 'both'].includes(input.templateSource)) out.templateSource = input.templateSource;
  return { ...DEFAULT_SETTINGS, ...out };
}
