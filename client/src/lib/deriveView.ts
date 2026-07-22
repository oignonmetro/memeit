import type {
  DbRoom,
  DbTemplates,
  Template,
  PublicPlayer,
  RoomSnapshot,
  RoundStartedPayload,
  RevealMemePayload,
  RevealResultPayload,
  RoundScoreboardPayload,
  GameEndedPayload,
} from '../types';
import { LIBRARY_TEMPLATES } from './libraryTemplates';

export interface DerivedView {
  room: RoomSnapshot | null;
  roundStarted: RoundStartedPayload | null;
  captionProgress: { submitted: number; total: number } | null;
  revealMeme: RevealMemePayload | null;
  lastResult: RevealResultPayload | null;
  roundScoreboard: RoundScoreboardPayload | null;
  gameEnded: GameEndedPayload | null;
  hasSubmitted: boolean;
  hasVotedCurrent: boolean;
}

const EMPTY_VIEW: DerivedView = {
  room: null,
  roundStarted: null,
  captionProgress: null,
  revealMeme: null,
  lastResult: null,
  roundScoreboard: null,
  gameEnded: null,
  hasSubmitted: false,
  hasVotedCurrent: false,
};

function buildTemplates(dbTemplates: DbTemplates | null): Template[] {
  const uploads: Template[] = Object.entries(dbTemplates || {}).map(([id, t]) => ({
    id,
    url: t.url,
    name: t.name,
    source: 'upload',
  }));
  return [...LIBRARY_TEMPLATES, ...uploads];
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

export function deriveView(code: string, dbRoom: DbRoom | null, dbTemplates: DbTemplates | null, selfId: string): DerivedView {
  if (!dbRoom) return EMPTY_VIEW;

  const templates = buildTemplates(dbTemplates);
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

  let roundStarted: RoundStartedPayload | null = null;
  let captionProgress: { submitted: number; total: number } | null = null;
  if (dbRoom.status === 'caption' && dbRoom.currentTemplateId) {
    const template = templates.find((t) => t.id === dbRoom.currentTemplateId) || null;
    if (template) {
      roundStarted = {
        roundNumber: dbRoom.currentRound,
        totalRounds: dbRoom.totalRounds,
        template,
        deadline: dbRoom.roundDeadline || Date.now(),
      };
    }
    captionProgress = {
      submitted: Object.keys(dbRoom.submissions || {}).length,
      total: players.filter((p) => p.connected).length,
    };
  }

  let revealMeme: RevealMemePayload | null = null;
  let lastResult: RevealResultPayload | null = null;
  if (dbRoom.status === 'voting') {
    const authorId = dbRoom.revealOrder?.[dbRoom.revealIndex];
    const submission = authorId ? dbRoom.submissions?.[authorId] : undefined;
    if (authorId && submission) {
      revealMeme = {
        index: dbRoom.revealIndex,
        total: (dbRoom.revealOrder || []).length,
        meme: { id: authorId, templateId: submission.templateId, layers: submission.layers || [], authorId },
        deadline: dbRoom.revealDeadline || Date.now(),
      };
      const result = dbRoom.revealResults?.[authorId];
      if (result) {
        lastResult = {
          memeId: authorId,
          authorId,
          authorNickname: dbRoom.players?.[authorId]?.nickname || '???',
          thumbsUp: result.thumbsUp,
        };
      }
    }
  }

  let roundScoreboard: RoundScoreboardPayload | null = null;
  if (dbRoom.status === 'round_results') {
    roundScoreboard = { roundNumber: dbRoom.currentRound, totalRounds: dbRoom.totalRounds, scores: players };
  }

  let gameEnded: GameEndedPayload | null = null;
  if (dbRoom.status === 'ended') {
    gameEnded = { scores: players, winnerId: dbRoom.winnerId };
  }

  const hasSubmitted = Boolean(dbRoom.submissions?.[selfId]);
  const currentAuthorId = dbRoom.revealOrder?.[dbRoom.revealIndex];
  const hasVotedCurrent = Boolean(currentAuthorId && dbRoom.votes?.[currentAuthorId]?.[selfId]);

  return { room, roundStarted, captionProgress, revealMeme, lastResult, roundScoreboard, gameEnded, hasSubmitted, hasVotedCurrent };
}
