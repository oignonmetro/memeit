export type Phase = 'lobby' | 'caption' | 'voting' | 'round_results' | 'ended';

export type TemplateSource = 'library' | 'upload';

export interface Template {
  id: string;
  url: string;
  name: string;
  source: TemplateSource;
}

export interface TextLayer {
  id: string;
  text: string;
  xPct: number;
  yPct: number;
  fontSize: 'sm' | 'md' | 'lg';
  color: string;
}

export interface RoomSettings {
  rounds: number;
  captionTimeSec: number;
  voteTimeSec: number;
  templateSource: 'library' | 'upload' | 'both';
}

export interface PublicPlayer {
  id: string;
  nickname: string;
  score: number;
  connected: boolean;
  isHost: boolean;
}

// ---- Raw shape stored under rooms/{code} in Realtime Database ----

export interface DbPlayer {
  nickname: string;
  score: number;
  connected: boolean;
  joinedAt: number;
}

export interface DbSubmission {
  layers: TextLayer[];
}

export interface DbRevealResult {
  thumbsUp: number;
}

export interface DbRoom {
  createdAt: number;
  lastActivityAt: number;
  hostId: string;
  settings: RoomSettings;
  status: Phase;
  players: Record<string, DbPlayer>;
  currentRound: number;
  totalRounds: number;
  currentTemplate: Template | null;
  roundDeadline: number | null;
  // submissions, revealOrder and votes are keyed by the author's playerId —
  // each player submits exactly one meme per round, so playerId doubles as memeId.
  submissions: Record<string, DbSubmission>;
  revealOrder: string[];
  revealIndex: number;
  revealDeadline: number | null;
  votes: Record<string, Record<string, boolean>>;
  revealResults: Record<string, DbRevealResult>;
  usedTemplateIds: string[];
  winnerId: string | null;
}

export interface DbUploadedTemplate {
  url: string;
  name: string;
  source: 'upload';
}

export type DbTemplates = Record<string, DbUploadedTemplate>;

// ---- View-model shapes consumed by UI components ----

export interface RoomSnapshot {
  code: string;
  phase: Phase;
  settings: RoomSettings;
  players: PublicPlayer[];
  currentRound: number;
  totalRounds: number;
  templates: Template[];
}

export interface RoundStartedPayload {
  roundNumber: number;
  totalRounds: number;
  template: Template;
  deadline: number;
}

export interface RevealMemePayload {
  index: number;
  total: number;
  template: Template;
  meme: { id: string; layers: TextLayer[]; authorId: string };
  deadline: number;
}

export interface RevealResultPayload {
  memeId: string;
  authorId: string;
  authorNickname: string;
  thumbsUp: number;
}

export interface RoundScoreboardPayload {
  roundNumber: number;
  totalRounds: number;
  scores: PublicPlayer[];
}

export interface GameEndedPayload {
  scores: PublicPlayer[];
  winnerId: string | null;
}

export const FONT_SIZES: Record<TextLayer['fontSize'], number> = { sm: 5.5, md: 8, lg: 11 };
export const TEXT_COLORS = ['#ffffff', '#000000', '#ffd166', '#ef476f', '#06d6a0'];
export const MAX_TEXT_LAYERS = 5;

export const DEFAULT_SETTINGS: RoomSettings = {
  rounds: 3,
  captionTimeSec: 75,
  voteTimeSec: 8,
  templateSource: 'both',
};

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 20;
export const REVEAL_PAUSE_SEC = 3;
export const ROUND_TRANSITION_PAUSE_SEC = 5;
export const ROOM_INACTIVITY_MS = 30 * 60 * 1000;
