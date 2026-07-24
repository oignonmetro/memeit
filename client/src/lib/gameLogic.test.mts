// Standalone end-to-end simulation of a full game for each of the 3 modes.
// Run: npx tsx src/lib/gameLogic.test.mts
import assert from 'node:assert';
import {
  reduceStartGame,
  reduceCaption,
  reduceReveal,
  reduceTally,
  reduceRoundResults,
  reduceChangeTemplate,
  buildPool,
} from './gameLogic';
import type { DbRoom, GameMode, Template } from '../types';
import { MAX_TEMPLATE_CHANGES } from '../types';

const LIB: Template[] = Array.from({ length: 6 }, (_, i) => ({
  id: `t${i}`,
  url: `t${i}.png`,
  name: `T${i}`,
  source: 'library' as const,
  boxes: [{ xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }],
}));

let clock = 1_000_000;
const tick = () => (clock += 60_000); // 60s per step — exceeds every phase deadline

function makeRoom(mode: GameMode): DbRoom {
  const players = {
    p1: { nickname: 'Alice', score: 0, connected: true, joinedAt: 0 },
    p2: { nickname: 'Bob', score: 0, connected: true, joinedAt: 1 },
    p3: { nickname: 'Cléa', score: 0, connected: true, joinedAt: 2 },
  };
  return {
    createdAt: 0,
    lastActivityAt: 0,
    hostId: 'p1',
    settings: { mode, rounds: 2, captionTimeSec: 90, revealTimeSec: 5, voteTimeSec: 30, templateSource: 'library' },
    status: 'lobby',
    players,
    currentRound: 0,
    totalRounds: 2,
    currentTemplate: null,
    roundTemplates: {},
    templateChanges: {},
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
}

function playRound(room: DbRoom, roundNo: number, mode: GameMode): DbRoom {
  // --- caption ---
  assert.equal(room.status, 'caption', `[${mode}] r${roundNo} should be in caption`);
  assert.equal(room.currentRound, roundNo, `[${mode}] round number`);

  const templates = room.roundTemplates;
  assert.ok(Object.keys(templates).length === 3, `[${mode}] every player got a template`);
  if (mode === 'meme') {
    assert.ok(room.currentTemplate, `[${mode}] shared template set`);
    const ids = new Set(Object.values(templates).map((t) => t.id));
    assert.equal(ids.size, 1, `[${mode}] all players share ONE template`);
  } else {
    assert.equal(room.currentTemplate, null, `[${mode}] no shared template`);
    const ids = new Set(Object.values(templates).map((t) => t.id));
    assert.equal(ids.size, 3, `[${mode}] each player got a DISTINCT template`);
  }

  // everyone submits
  for (const id of ['p1', 'p2', 'p3']) room.submissions[id] = { layers: [{ text: `meme ${id}`, xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 }] };
  room = reduceCaption(room, tick())!;
  assert.equal(room.status, 'reveal', `[${mode}] caption -> reveal once all submitted`);
  assert.equal(room.revealOrder.length, 3, `[${mode}] 3 memes queued for reveal`);

  // --- reveal: every meme shown one by one ---
  const seen: number[] = [];
  let guard = 0;
  while (room.status === 'reveal' && guard++ < 20) {
    seen.push(room.revealIndex);
    room = reduceReveal(room, tick())!;
  }
  assert.deepEqual(seen, [0, 1, 2], `[${mode}] all 3 memes revealed one by one`);

  if (mode === 'detendu') {
    assert.equal(room.status, 'round_results', `[detendu] reveal -> round_results (no vote)`);
    assert.deepEqual(room.lastRoundVotes, {}, `[detendu] no votes recorded`);
    assert.equal(room.roundWinnerId, null, `[detendu] no round winner`);
    return room;
  }

  // --- vote (normal / meme): concentrate votes on p2 ---
  assert.equal(room.status, 'vote', `[${mode}] reveal -> vote`);
  room.favoriteVotes = { p1: 'p2', p3: 'p2', p2: 'p1' };
  room = reduceTally(room, tick())!;
  assert.equal(room.status, 'round_results', `[${mode}] vote -> round_results`);
  assert.equal(room.roundWinnerId, 'p2', `[${mode}] p2 wins the round (2 votes)`);
  assert.equal(room.lastRoundVotes.p2, 2, `[${mode}] p2 got 2 votes`);
  assert.equal(room.lastRoundVotes.p1, 1, `[${mode}] p1 got 1 vote`);
  return room;
}

function playGame(mode: GameMode): string {
  let room = makeRoom(mode);
  room = reduceStartGame(room, LIB, [], tick())!;

  for (let r = 1; r <= 2; r++) {
    room = playRound(room, r, mode);
    room = reduceRoundResults(room, LIB, [], tick())!;
    if (r < 2) assert.equal(room.status, 'caption', `[${mode}] round_results -> next caption`);
  }

  assert.equal(room.status, 'ended', `[${mode}] game ends after 2 rounds`);

  if (mode === 'detendu') {
    const scores = Object.values(room.players).map((p) => p.score);
    assert.deepEqual(scores, [0, 0, 0], `[detendu] nobody scored`);
  } else {
    // p2 won both rounds with 2 votes each → 4; p1 got 1 each → 2; p3 → 0.
    assert.equal(room.players.p2.score, 4, `[${mode}] p2 cumulative score`);
    assert.equal(room.players.p1.score, 2, `[${mode}] p1 cumulative score`);
    assert.equal(room.players.p3.score, 0, `[${mode}] p3 cumulative score`);
    assert.equal(room.winnerId, 'p2', `[${mode}] p2 wins the game`);
  }
  return `PASS  ${mode.padEnd(8)} → ${room.status}, scores ${Object.values(room.players).map((p) => p.score).join('/')}, vainqueur ${room.winnerId ?? '—'}`;
}

function testTemplateChanges(mode: GameMode): string {
  let room = makeRoom(mode);
  room = reduceStartGame(room, LIB, [], tick())!;
  const pool = buildPool(room.settings, LIB, []);
  const startId = room.roundTemplates.p1.id;

  // p1 re-rolls 5 times; each must succeed and (usually) change the template.
  for (let i = 1; i <= MAX_TEMPLATE_CHANGES; i++) {
    const before = room.roundTemplates.p1.id;
    room = reduceChangeTemplate(room, 'p1', pool, tick())!;
    assert.equal(room.templateChanges.p1, i, `[${mode}] change #${i} counted`);
    assert.notEqual(room.roundTemplates.p1.id, before, `[${mode}] template actually changed on #${i}`);
  }
  assert.ok(MAX_TEMPLATE_CHANGES >= 5, 'at least 5 changes allowed');

  // 6th change is blocked (cap reached).
  const capped = reduceChangeTemplate(room, 'p1', pool, tick())!;
  assert.equal(capped.templateChanges.p1, MAX_TEMPLATE_CHANGES, `[${mode}] change capped at ${MAX_TEMPLATE_CHANGES}`);

  // Changing p1 must not affect other players' templates.
  assert.equal(room.templateChanges.p2 ?? 0, 0, `[${mode}] p2 unaffected`);

  return `PASS  ${mode.padEnd(8)} → ${MAX_TEMPLATE_CHANGES} changements OK puis plafonné (départ ${startId} → ${room.roundTemplates.p1.id})`;
}

let ok = true;
for (const mode of ['normal', 'meme', 'detendu'] as GameMode[]) {
  try {
    console.log(playGame(mode));
  } catch (e) {
    ok = false;
    console.error(`FAIL  ${mode}:`, (e as Error).message);
  }
}
console.log('--- changement de template ---');
for (const mode of ['normal', 'meme', 'detendu'] as GameMode[]) {
  try {
    console.log(testTemplateChanges(mode));
  } catch (e) {
    ok = false;
    console.error(`FAIL  ${mode} (template):`, (e as Error).message);
  }
}
console.log(ok ? '\nRESULT: PASS — les 3 modes bouclent une partie complète.' : '\nRESULT: FAIL');
process.exit(ok ? 0 : 1);
