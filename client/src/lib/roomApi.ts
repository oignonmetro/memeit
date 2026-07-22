import {
  ref,
  get,
  set,
  update,
  onValue,
  runTransaction,
  onDisconnect,
  push,
  type Unsubscribe,
} from 'firebase/database';
import { db } from './firebase';
import { generateRoomCode } from './codes';
import { LIBRARY_TEMPLATES } from './libraryTemplates';
import type { DbRoom, DbTemplates, RoomSettings, TextLayer } from '../types';
import { DEFAULT_SETTINGS, ROOM_INACTIVITY_MS } from '../types';

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
      currentTemplateId: null,
      roundDeadline: null,
      submissions: {},
      revealOrder: [],
      revealIndex: -1,
      revealDeadline: null,
      votes: {},
      revealResults: {},
      usedTemplateIds: [],
      winnerId: null,
    };
    // eslint-disable-next-line no-await-in-loop
    await set(r, initial);
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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickTemplateId(settings: RoomSettings, customIds: string[], usedIds: string[]): string {
  let pool: string[];
  if (settings.templateSource === 'library') pool = LIBRARY_TEMPLATES.map((t) => t.id);
  else if (settings.templateSource === 'upload') pool = customIds.length ? customIds : LIBRARY_TEMPLATES.map((t) => t.id);
  else pool = [...LIBRARY_TEMPLATES.map((t) => t.id), ...customIds];

  const candidates = pool.filter((id) => !usedIds.includes(id));
  const finalPool = candidates.length ? candidates : pool;
  return finalPool[Math.floor(Math.random() * finalPool.length)];
}

function beginRound(room: DbRoom, customIds: string[], roundNumber: number): DbRoom {
  const templateId = pickTemplateId(room.settings, customIds, room.usedTemplateIds || []);
  return {
    ...room,
    status: 'caption',
    currentRound: roundNumber,
    currentTemplateId: templateId,
    usedTemplateIds: [...(room.usedTemplateIds || []), templateId],
    roundDeadline: Date.now() + room.settings.captionTimeSec * 1000,
    submissions: {},
    revealOrder: [],
    revealIndex: -1,
    revealDeadline: null,
    votes: {},
    revealResults: {},
    lastActivityAt: Date.now(),
  };
}

async function getCustomTemplateIds(code: string): Promise<string[]> {
  const snap = await get(templatesRef(code));
  return snap.exists() ? Object.keys(snap.val()) : [];
}

export async function startGame(code: string): Promise<void> {
  const customIds = await getCustomTemplateIds(code);
  await runTransaction(roomRef(code), (room: DbRoom | null) => {
    if (!room || room.status !== 'lobby') return room;
    const connectedCount = Object.values(room.players || {}).filter((p) => p.connected).length;
    if (connectedCount < 2) return room;
    return beginRound(room, customIds, 1);
  });
}

export async function submitMeme(code: string, playerId: string, templateId: string, layers: TextLayer[]): Promise<void> {
  await update(roomRef(code), {
    [`submissions/${playerId}`]: { templateId, layers },
    lastActivityAt: Date.now(),
  });
  await maybeAdvanceFromCaption(code);
}

export async function maybeAdvanceFromCaption(code: string): Promise<void> {
  await runTransaction(roomRef(code), (room: DbRoom | null) => {
    if (!room || room.status !== 'caption') return room;
    const connectedIds = Object.entries(room.players || {})
      .filter(([, p]) => p.connected)
      .map(([id]) => id);
    const deadlinePassed = room.roundDeadline != null && Date.now() >= room.roundDeadline;
    const allSubmitted = connectedIds.every((id) => room.submissions?.[id]);
    if (!allSubmitted && !deadlinePassed) return room;

    const submissions = { ...(room.submissions || {}) };
    for (const id of connectedIds) {
      if (!submissions[id]) submissions[id] = { templateId: room.currentTemplateId!, layers: [] };
    }
    const revealOrder = shuffle(Object.keys(submissions));
    return {
      ...room,
      submissions,
      status: 'voting',
      revealOrder,
      revealIndex: 0,
      revealDeadline: Date.now() + room.settings.voteTimeSec * 1000,
      votes: {},
      revealResults: {},
      lastActivityAt: Date.now(),
    };
  });
}

export async function castVote(code: string, authorId: string, voterId: string, thumbsUp: boolean): Promise<void> {
  if (thumbsUp) {
    await update(roomRef(code), {
      [`votes/${authorId}/${voterId}`]: true,
      lastActivityAt: Date.now(),
    });
  }
}

export async function maybeResolveCurrentReveal(code: string): Promise<void> {
  await runTransaction(roomRef(code), (room: DbRoom | null) => {
    if (!room || room.status !== 'voting') return room;
    const authorId = room.revealOrder?.[room.revealIndex];
    if (!authorId || room.revealResults?.[authorId]) return room;
    const deadlinePassed = room.revealDeadline != null && Date.now() >= room.revealDeadline;
    if (!deadlinePassed) return room;

    const thumbsUp = Object.keys(room.votes?.[authorId] || {}).length;
    const players = { ...room.players };
    if (players[authorId]) {
      players[authorId] = { ...players[authorId], score: (players[authorId].score || 0) + thumbsUp };
    }
    return {
      ...room,
      players,
      revealResults: { ...(room.revealResults || {}), [authorId]: { thumbsUp } },
      lastActivityAt: Date.now(),
    };
  });
}

export async function advanceReveal(code: string): Promise<void> {
  await runTransaction(roomRef(code), (room: DbRoom | null) => {
    if (!room || room.status !== 'voting') return room;
    const authorId = room.revealOrder?.[room.revealIndex];
    if (!authorId || !room.revealResults?.[authorId]) return room;
    const nextIndex = room.revealIndex + 1;
    if (nextIndex >= (room.revealOrder || []).length) {
      return { ...room, status: 'round_results', lastActivityAt: Date.now() };
    }
    return {
      ...room,
      revealIndex: nextIndex,
      revealDeadline: Date.now() + room.settings.voteTimeSec * 1000,
      lastActivityAt: Date.now(),
    };
  });
}

export async function advanceAfterRoundResults(code: string): Promise<void> {
  const customIds = await getCustomTemplateIds(code);
  await runTransaction(roomRef(code), (room: DbRoom | null) => {
    if (!room || room.status !== 'round_results') return room;
    if (room.currentRound >= room.totalRounds) {
      let winnerId: string | null = null;
      let bestScore = -Infinity;
      for (const [id, p] of Object.entries(room.players || {})) {
        if (p.score > bestScore) {
          bestScore = p.score;
          winnerId = id;
        }
      }
      return { ...room, status: 'ended', winnerId, lastActivityAt: Date.now() };
    }
    return beginRound(room, customIds, room.currentRound + 1);
  });
}

// ---------- inactivity cleanup (client-driven, no server) ----------

export async function cleanupIfInactive(code: string): Promise<void> {
  await runTransaction(roomRef(code), (room: DbRoom | null) => {
    if (!room) return room;
    if (Date.now() - (room.lastActivityAt || 0) >= ROOM_INACTIVITY_MS) return null;
    return room;
  });
}
