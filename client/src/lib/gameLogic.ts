import type { DbRoom, RoomSettings, Template } from '../types';
import { MAX_TEMPLATE_CHANGES } from '../types';

// Pure game-state reducers, extracted from the Realtime Database transactions
// in roomApi.ts so they can be reasoned about and unit-tested without Firebase.
// Each reducer takes the current room and returns the next room; returning the
// same room means "no transition" (the RTDB transaction commits it unchanged).
// `now` is injected instead of calling Date.now() directly so tests can drive
// deadlines deterministically.

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildPool(settings: RoomSettings, libraryTemplates: Template[], customTemplates: Template[]): Template[] {
  if (settings.templateSource === 'library') return libraryTemplates;
  if (settings.templateSource === 'upload') return customTemplates.length ? customTemplates : libraryTemplates;
  return [...libraryTemplates, ...customTemplates];
}

function pickOne(pool: Template[], usedIds: string[]): Template {
  const candidates = pool.filter((t) => !usedIds.includes(t.id));
  const finalPool = candidates.length ? candidates : pool;
  return finalPool[Math.floor(Math.random() * finalPool.length)];
}

// Assigns one template per player. In "meme" mode everyone shares the same one;
// otherwise each player gets a distinct template while the pool allows it.
export function assignTemplates(
  settings: RoomSettings,
  playerIds: string[],
  pool: Template[],
  usedIds: string[]
): { roundTemplates: Record<string, Template>; sharedTemplate: Template | null; newlyUsed: string[] } {
  if (pool.length === 0) return { roundTemplates: {}, sharedTemplate: null, newlyUsed: [] };

  if (settings.mode === 'meme') {
    const template = pickOne(pool, usedIds);
    const roundTemplates: Record<string, Template> = {};
    for (const id of playerIds) roundTemplates[id] = template;
    return { roundTemplates, sharedTemplate: template, newlyUsed: [template.id] };
  }

  const fresh = shuffle(pool.filter((t) => !usedIds.includes(t.id)));
  const roundTemplates: Record<string, Template> = {};
  const newlyUsed: string[] = [];
  let freshIdx = 0;
  for (const id of playerIds) {
    const template = freshIdx < fresh.length ? fresh[freshIdx++] : pool[Math.floor(Math.random() * pool.length)];
    roundTemplates[id] = template;
    newlyUsed.push(template.id);
  }
  return { roundTemplates, sharedTemplate: null, newlyUsed };
}

export function beginRound(
  room: DbRoom,
  libraryTemplates: Template[],
  customTemplates: Template[],
  roundNumber: number,
  now: number
): DbRoom {
  const pool = buildPool(room.settings, libraryTemplates, customTemplates);
  const playerIds = Object.keys(room.players || {});
  const { roundTemplates, sharedTemplate, newlyUsed } = assignTemplates(room.settings, playerIds, pool, room.usedTemplateIds || []);
  return {
    ...room,
    status: 'caption',
    currentRound: roundNumber,
    currentTemplate: sharedTemplate,
    roundTemplates,
    templateChanges: {},
    usedTemplateIds: [...(room.usedTemplateIds || []), ...newlyUsed],
    roundDeadline: now + room.settings.captionTimeSec * 1000,
    submissions: {},
    revealOrder: [],
    revealIndex: -1,
    revealDeadline: null,
    voteDeadline: null,
    favoriteVotes: {},
    lastRoundVotes: {},
    roundWinnerId: null,
    lastActivityAt: now,
  };
}

export function reduceStartGame(
  room: DbRoom | null,
  libraryTemplates: Template[],
  customTemplates: Template[],
  now: number
): DbRoom | null {
  if (!room || room.status !== 'lobby') return room;
  const connectedCount = Object.values(room.players || {}).filter((p) => p.connected).length;
  if (connectedCount < 2) return room;
  return beginRound(room, libraryTemplates, customTemplates, 1, now);
}

// A player re-rolls their own template during the caption phase (any mode).
// `pool` is the available template pool. Capped at MAX_TEMPLATE_CHANGES.
export function reduceChangeTemplate(room: DbRoom | null, playerId: string, pool: Template[], now: number): DbRoom | null {
  if (!room || room.status !== 'caption') return room;
  const changes = room.templateChanges?.[playerId] || 0;
  if (changes >= MAX_TEMPLATE_CHANGES) return room;
  const current = room.roundTemplates?.[playerId];
  const candidates = pool.filter((t) => t.id !== current?.id);
  if (candidates.length === 0) return room;
  const next = candidates[Math.floor(Math.random() * candidates.length)];
  return {
    ...room,
    roundTemplates: { ...(room.roundTemplates || {}), [playerId]: next },
    templateChanges: { ...(room.templateChanges || {}), [playerId]: changes + 1 },
    lastActivityAt: now,
  };
}

export function reduceCaption(room: DbRoom | null, now: number): DbRoom | null {
  if (!room || room.status !== 'caption') return room;
  const connectedIds = Object.entries(room.players || {})
    .filter(([, p]) => p.connected)
    .map(([id]) => id);
  const deadlinePassed = room.roundDeadline != null && now >= room.roundDeadline;
  const allSubmitted = connectedIds.every((id) => room.submissions?.[id]);
  if (!allSubmitted && !deadlinePassed) return room;

  const submissions = { ...(room.submissions || {}) };
  for (const id of connectedIds) {
    if (!submissions[id]) submissions[id] = { layers: [] };
  }
  const revealOrder = shuffle(Object.keys(submissions));
  return {
    ...room,
    submissions,
    status: 'reveal',
    revealOrder,
    revealIndex: 0,
    revealDeadline: now + room.settings.revealTimeSec * 1000,
    voteDeadline: null,
    favoriteVotes: {},
    lastActivityAt: now,
  };
}

export function reduceReveal(room: DbRoom | null, now: number): DbRoom | null {
  if (!room || room.status !== 'reveal') return room;
  const deadlinePassed = room.revealDeadline != null && now >= room.revealDeadline;
  if (!deadlinePassed) return room;
  const nextIndex = room.revealIndex + 1;
  if (nextIndex >= (room.revealOrder || []).length) {
    // Détendu mode has no vote and no scoring — go straight to the round wrap-up.
    if (room.settings.mode === 'detendu') {
      return { ...room, status: 'round_results', lastRoundVotes: {}, roundWinnerId: null, lastActivityAt: now };
    }
    return {
      ...room,
      status: 'vote',
      voteDeadline: now + room.settings.voteTimeSec * 1000,
      favoriteVotes: {},
      lastActivityAt: now,
    };
  }
  return { ...room, revealIndex: nextIndex, revealDeadline: now + room.settings.revealTimeSec * 1000, lastActivityAt: now };
}

export function reduceTally(room: DbRoom | null, now: number): DbRoom | null {
  if (!room || room.status !== 'vote') return room;
  const connectedIds = Object.entries(room.players || {})
    .filter(([, p]) => p.connected)
    .map(([id]) => id);
  const deadlinePassed = room.voteDeadline != null && now >= room.voteDeadline;
  const allVoted = connectedIds.every((id) => room.favoriteVotes?.[id]);
  if (!allVoted && !deadlinePassed) return room;

  const counts: Record<string, number> = {};
  for (const author of Object.values(room.favoriteVotes || {})) {
    counts[author] = (counts[author] || 0) + 1;
  }
  const players = { ...room.players };
  for (const [author, c] of Object.entries(counts)) {
    if (players[author]) players[author] = { ...players[author], score: (players[author].score || 0) + c };
  }
  let winnerId: string | null = null;
  let best = 0;
  for (const author of room.revealOrder || []) {
    const c = counts[author] || 0;
    if (c > best) {
      best = c;
      winnerId = author;
    }
  }
  return {
    ...room,
    players,
    status: 'round_results',
    lastRoundVotes: counts,
    roundWinnerId: winnerId,
    voteDeadline: null,
    lastActivityAt: now,
  };
}

export function reduceRoundResults(
  room: DbRoom | null,
  libraryTemplates: Template[],
  customTemplates: Template[],
  now: number
): DbRoom | null {
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
    return { ...room, status: 'ended', winnerId, lastActivityAt: now };
  }
  return beginRound(room, libraryTemplates, customTemplates, room.currentRound + 1, now);
}
