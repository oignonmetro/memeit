import type {
  DbRoom,
  DbTemplates,
  Template,
  PublicPlayer,
  RoomSnapshot,
  RoundStartedPayload,
  RevealMemePayload,
  VoteStatePayload,
  RoundScoreboardPayload,
  GameEndedPayload,
} from '../types';

export interface DerivedView {
  room: RoomSnapshot | null;
  roundStarted: RoundStartedPayload | null;
  captionProgress: { submitted: number; total: number } | null;
  revealMeme: RevealMemePayload | null;
  voteState: VoteStatePayload | null;
  roundScoreboard: RoundScoreboardPayload | null;
  gameEnded: GameEndedPayload | null;
  hasSubmitted: boolean;
}

const EMPTY_VIEW: DerivedView = {
  room: null,
  roundStarted: null,
  captionProgress: null,
  revealMeme: null,
  voteState: null,
  roundScoreboard: null,
  gameEnded: null,
  hasSubmitted: false,
};

function buildTemplates(libraryTemplates: Template[], dbTemplates: DbTemplates | null): Template[] {
  const uploads: Template[] = Object.entries(dbTemplates || {}).map(([id, t]) => ({
    id,
    url: t.url,
    name: t.name,
    source: 'upload',
  }));
  return [...libraryTemplates, ...uploads];
}

function buildPlayers(dbRoom: DbRoom): PublicPlayer[] {
  return Object.entries(dbRoom.players || {})
    .filter(([, p]) => p && p.nickname)
    .map(([id, p]) => ({
      id,
      nickname: p.nickname,
      score: p.score || 0,
      connected: Boolean(p.connected),
      isHost: id === dbRoom.hostId,
    }))
    .sort((a, b) => b.score - a.score);
}

export function deriveView(
  code: string,
  dbRoom: DbRoom | null,
  dbTemplates: DbTemplates | null,
  libraryTemplates: Template[],
  selfId: string
): DerivedView {
  if (!dbRoom) return EMPTY_VIEW;

  const templates = buildTemplates(libraryTemplates, dbTemplates);
  const players = buildPlayers(dbRoom);
  const room: RoomSnapshot = {
    code,
    phase: dbRoom.status,
    settings: dbRoom.settings,
    players,
    currentRound: dbRoom.currentRound,
    totalRounds: dbRoom.totalRounds,
    templates,
  };

  const templateFor = (authorId: string): Template | null =>
    dbRoom.roundTemplates?.[authorId] || dbRoom.currentTemplate || null;

  let roundStarted: RoundStartedPayload | null = null;
  let captionProgress: { submitted: number; total: number } | null = null;
  if (dbRoom.status === 'caption') {
    roundStarted = {
      roundNumber: dbRoom.currentRound,
      totalRounds: dbRoom.totalRounds,
      template: templateFor(selfId),
      deadline: dbRoom.roundDeadline || Date.now(),
    };
    captionProgress = {
      submitted: Object.keys(dbRoom.submissions || {}).length,
      total: players.filter((p) => p.connected).length,
    };
  }

  let revealMeme: RevealMemePayload | null = null;
  if (dbRoom.status === 'reveal') {
    const authorId = dbRoom.revealOrder?.[dbRoom.revealIndex];
    const submission = authorId ? dbRoom.submissions?.[authorId] : undefined;
    const template = authorId ? templateFor(authorId) : null;
    if (authorId && submission && template) {
      revealMeme = {
        index: dbRoom.revealIndex,
        total: (dbRoom.revealOrder || []).length,
        template,
        meme: { authorId, layers: submission.layers || [] },
        deadline: dbRoom.revealDeadline || Date.now(),
      };
    }
  }

  let voteState: VoteStatePayload | null = null;
  if (dbRoom.status === 'vote') {
    const order = dbRoom.revealOrder || [];
    const memes = order
      .filter((authorId) => dbRoom.submissions?.[authorId] && templateFor(authorId))
      .map((authorId) => ({ authorId, template: templateFor(authorId)!, layers: dbRoom.submissions[authorId].layers || [] }));
    const connectedTotal = players.filter((p) => p.connected).length;
    voteState = {
      memes,
      deadline: dbRoom.voteDeadline || Date.now(),
      myVote: dbRoom.favoriteVotes?.[selfId] || null,
      votedCount: Object.keys(dbRoom.favoriteVotes || {}).length,
      total: connectedTotal,
    };
  }

  let roundScoreboard: RoundScoreboardPayload | null = null;
  if (dbRoom.status === 'round_results') {
    const winnerId = dbRoom.roundWinnerId;
    const winnerSubmission = winnerId ? dbRoom.submissions?.[winnerId] : undefined;
    const winnerTemplate = winnerId ? templateFor(winnerId) : null;
    const winner =
      winnerId && winnerSubmission && winnerTemplate
        ? {
            authorId: winnerId,
            nickname: dbRoom.players?.[winnerId]?.nickname || '???',
            votes: dbRoom.lastRoundVotes?.[winnerId] || 0,
            template: winnerTemplate,
            layers: winnerSubmission.layers || [],
          }
        : null;
    roundScoreboard = {
      roundNumber: dbRoom.currentRound,
      totalRounds: dbRoom.totalRounds,
      scores: players,
      winner,
    };
  }

  let gameEnded: GameEndedPayload | null = null;
  if (dbRoom.status === 'ended') {
    gameEnded = { scores: players, winnerId: dbRoom.winnerId };
  }

  const hasSubmitted = Boolean(dbRoom.submissions?.[selfId]);

  return { room, roundStarted, captionProgress, revealMeme, voteState, roundScoreboard, gameEnded, hasSubmitted };
}
