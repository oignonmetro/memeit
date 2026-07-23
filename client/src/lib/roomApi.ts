import {
  ref,
  get,
  set,
  update,
  onValue,
  runTransaction,
  onDisconnect,
  push,
  query,
  orderByValue,
  endAt,
  limitToFirst,
  remove,
  type Unsubscribe,
} from 'firebase/database';
import { db } from './firebase';
import { generateRoomCode } from './codes';
import { getPopularTemplates } from './imgflip';
import { DEFAULT_UPLOAD_BOXES } from './templateBoxes';
import {
  reduceStartGame,
  reduceCaption,
  reduceReveal,
  reduceTally,
  reduceRoundResults,
} from './gameLogic';
import type { DbRoom, DbTemplates, RoomSettings, TextLayer, Template } from '../types';
import { DEFAULT_SETTINGS, ROOM_INACTIVITY_MS, CAPTION_TIME_OPTIONS } from '../types';

function requireDb() {
  if (!db) throw new Error('Firebase n\'est pas configuré (variables VITE_FIREBASE_* manquantes).');
  return db;
}

function roomRef(code: string) {
  return ref(requireDb(), `rooms/${code.toUpperCase()}`);
}

function templatesRef(code: string) {
  return ref(requireDb(), `rooms/${code.toUpperCase()}/templates`);
}

// Lightweight per-room heartbeat index (code -> last-seen timestamp), kept in a
// separate top-level node so the sweep only reads timestamps, never the rooms'
// full content (which includes base64 custom templates).
function roomActivityRef(code: string) {
  return ref(requireDb(), `roomActivity/${code.toUpperCase()}`);
}

// ---------- create / join / leave / presence ----------

export async function createRoom(playerId: string, nickname: string, settings: Partial<RoomSettings>): Promise<string> {
  const database = requireDb();
  const merged: RoomSettings = { ...DEFAULT_SETTINGS, ...settings };
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const r = ref(database, `rooms/${code}`);
    // eslint-disable-next-line no-await-in-loop
    const snap = await get(r);
    if (snap.exists()) continue;
    const initial: DbRoom = {
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      hostId: playerId,
      settings: merged,
      status: 'lobby',
      players: { [playerId]: { nickname, score: 0, connected: true, joinedAt: Date.now() } },
      currentRound: 0,
      totalRounds: merged.rounds,
      currentTemplate: null,
      roundTemplates: {},
      roundDeadline: null,
      submissions: {},
      revealOrder: [],
      revealIndex: -1,
      revealDeadline: null,
      voteDeadline: null,
      favoriteVotes: {},
      lastRoundVotes: {},
      roundWinnerId: null,
      usedTemplateIds: [],
      winnerId: null,
    };
    // eslint-disable-next-line no-await-in-loop
    await set(r, initial);
    // Heartbeat is best-effort: never fail room creation over it (e.g. if the
    // updated security rules haven't propagated yet).
    // eslint-disable-next-line no-await-in-loop
    await set(ref(database, `roomActivity/${code}`), Date.now()).catch(() => {});
    registerPresence(code, playerId);
    return code;
  }
  throw new Error('Impossible de créer une salle, réessaie.');
}

export async function joinRoom(code: string, playerId: string, nickname: string): Promise<void> {
  const r = roomRef(code);
  const snap = await get(r);
  if (!snap.exists()) throw new Error('Cette salle n\'existe pas.');
  const room = snap.val() as DbRoom;
  const alreadyIn = Boolean(room.players?.[playerId]);
  if (!alreadyIn && room.status !== 'lobby') throw new Error('La partie a déjà commencé.');
  await update(r, {
    [`players/${playerId}/nickname`]: nickname,
    [`players/${playerId}/score`]: room.players?.[playerId]?.score ?? 0,
    [`players/${playerId}/connected`]: true,
    [`players/${playerId}/joinedAt`]: room.players?.[playerId]?.joinedAt ?? Date.now(),
    lastActivityAt: Date.now(),
  });
  registerPresence(code, playerId);
}

export async function joinTv(code: string): Promise<void> {
  const snap = await get(roomRef(code));
  if (!snap.exists()) throw new Error('Cette salle n\'existe pas.');
}

export function registerPresence(code: string, playerId: string) {
  const database = requireDb();
  const connectedRef = ref(database, `rooms/${code.toUpperCase()}/players/${playerId}/connected`);
  onDisconnect(connectedRef).set(false);
}

// Re-marks an already-known player as connected after a page reload, and
// re-registers the onDisconnect hook for the new connection.
export async function markConnected(code: string, playerId: string): Promise<void> {
  await update(roomRef(code), { [`players/${playerId}/connected`]: true });
  registerPresence(code, playerId);
}

export async function leaveRoomLobby(code: string, playerId: string): Promise<void> {
  const r = roomRef(code);
  await runTransaction(r, (room: DbRoom | null) => {
    if (!room) return room;
    if (room.status !== 'lobby') return room; // quitter en cours de partie garde le score
    const players = { ...room.players };
    delete players[playerId];
    const remainingIds = Object.keys(players);
    if (remainingIds.length === 0) return null;
    const hostId = room.hostId === playerId ? remainingIds[0] : room.hostId;
    return { ...room, players, hostId };
  });
}

// ---------- settings (host, lobby only) ----------

export async function setCaptionTime(code: string, seconds: number): Promise<void> {
  const clamped = CAPTION_TIME_OPTIONS.includes(seconds) ? seconds : DEFAULT_SETTINGS.captionTimeSec;
  await runTransaction(roomRef(code), (room: DbRoom | null) => {
    if (!room || room.status !== 'lobby') return room;
    return { ...room, settings: { ...room.settings, captionTimeSec: clamped }, lastActivityAt: Date.now() };
  });
}

export async function setRounds(code: string, rounds: number): Promise<void> {
  const clamped = Math.min(10, Math.max(1, Math.round(rounds)));
  await runTransaction(roomRef(code), (room: DbRoom | null) => {
    if (!room || room.status !== 'lobby') return room;
    return { ...room, settings: { ...room.settings, rounds: clamped }, totalRounds: clamped, lastActivityAt: Date.now() };
  });
}

export async function setMode(code: string, mode: RoomSettings['mode']): Promise<void> {
  if (!['normal', 'meme', 'detendu'].includes(mode)) return;
  await runTransaction(roomRef(code), (room: DbRoom | null) => {
    if (!room || room.status !== 'lobby') return room;
    return { ...room, settings: { ...room.settings, mode }, lastActivityAt: Date.now() };
  });
}

// ---------- templates ----------

export async function addCustomTemplate(code: string, dataUrl: string): Promise<string> {
  const newRef = push(templatesRef(code));
  await set(newRef, { url: dataUrl, name: 'Template perso', source: 'upload' });
  await update(roomRef(code), { lastActivityAt: Date.now() });
  return newRef.key!;
}

// ---------- subscriptions ----------

export function subscribeRoom(code: string, callback: (room: DbRoom | null) => void): Unsubscribe {
  return onValue(roomRef(code), (snap) => callback(snap.val()));
}

export function subscribeTemplates(code: string, callback: (templates: DbTemplates) => void): Unsubscribe {
  return onValue(templatesRef(code), (snap) => callback(snap.val() || {}));
}

// ---------- game flow ----------
// The pure state transitions live in gameLogic.ts; the functions below are the
// thin Realtime Database wrappers (load templates, run the transaction).

async function getCustomTemplates(code: string): Promise<Template[]> {
  const snap = await get(templatesRef(code));
  if (!snap.exists()) return [];
  const data = snap.val() as DbTemplates;
  return Object.entries(data).map(([id, t]) => ({
    id,
    url: t.url,
    name: t.name,
    source: 'upload' as const,
    boxes: DEFAULT_UPLOAD_BOXES,
  }));
}

export async function startGame(code: string): Promise<void> {
  const [libraryTemplates, customTemplates] = await Promise.all([getPopularTemplates(), getCustomTemplates(code)]);
  await runTransaction(roomRef(code), (room: DbRoom | null) => reduceStartGame(room, libraryTemplates, customTemplates, Date.now()));
}

export async function submitMeme(code: string, playerId: string, layers: TextLayer[]): Promise<void> {
  await update(roomRef(code), {
    [`submissions/${playerId}`]: { layers },
    lastActivityAt: Date.now(),
  });
  await maybeAdvanceFromCaption(code);
}

export async function maybeAdvanceFromCaption(code: string): Promise<void> {
  await runTransaction(roomRef(code), (room: DbRoom | null) => reduceCaption(room, Date.now()));
}

// Reveal phase: advance to the next meme, or move to the vote phase once all
// memes have been shown one by one.
export async function advanceReveal(code: string): Promise<void> {
  await runTransaction(roomRef(code), (room: DbRoom | null) => reduceReveal(room, Date.now()));
}

// Vote phase: each player picks their single favorite meme of the round
// (cannot be their own).
export async function castFavorite(code: string, voterId: string, authorId: string): Promise<void> {
  if (voterId === authorId) return;
  await update(roomRef(code), {
    [`favoriteVotes/${voterId}`]: authorId,
    lastActivityAt: Date.now(),
  });
  await maybeTallyVotes(code);
}

export async function maybeTallyVotes(code: string): Promise<void> {
  await runTransaction(roomRef(code), (room: DbRoom | null) => reduceTally(room, Date.now()));
}

export async function advanceAfterRoundResults(code: string): Promise<void> {
  const [libraryTemplates, customTemplates] = await Promise.all([getPopularTemplates(), getCustomTemplates(code)]);
  await runTransaction(roomRef(code), (room: DbRoom | null) => reduceRoundResults(room, libraryTemplates, customTemplates, Date.now()));
}

// ---------- room lifetime (client-driven, no server) ----------

// A room lives as long as at least one device has it open. Every connected
// client bumps its heartbeat; a room whose heartbeat is older than the
// inactivity window has been abandoned and is swept.

export async function touchActivity(code: string): Promise<void> {
  await set(roomActivityRef(code), Date.now());
}

// Opportunistic cleanup: called when entering a room. Reads only the small
// heartbeat index (timestamps), then deletes abandoned rooms (both the room
// node and its heartbeat entry). Bounded to a handful per call.
export async function sweepStaleRooms(): Promise<void> {
  const database = requireDb();
  const cutoff = Date.now() - ROOM_INACTIVITY_MS;
  try {
    const q = query(ref(database, 'roomActivity'), orderByValue(), endAt(cutoff), limitToFirst(20));
    const snap = await get(q);
    if (!snap.exists()) return;
    const ops: Promise<unknown>[] = [];
    snap.forEach((child) => {
      const code = child.key;
      if (!code) return undefined;
      ops.push(remove(ref(database, `rooms/${code}`)));
      ops.push(remove(ref(database, `roomActivity/${code}`)));
      return undefined;
    });
    await Promise.all(ops);
  } catch {
    // Index missing / offline / permission — ignore; the heartbeat still lets a
    // later sweep (from another client) clean the room up.
  }
}
