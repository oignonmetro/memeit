// Core domain types shared conceptually with the client (kept in sync manually,
// see client/src/types.ts).

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
  xPct: number; // 0-100, center of the text box
  yPct: number; // 0-100
  fontSize: 'sm' | 'md' | 'lg';
  color: string;
}

export interface RoomSettings {
  rounds: number;
  captionTimeSec: number;
  voteTimeSec: number;
  templateSource: 'library' | 'upload' | 'both';
}

export interface Player {
  id: string;
  nickname: string;
  score: number;
  connected: boolean;
  isHost: boolean;
}

export interface Meme {
  id: string;
  authorId: string;
  templateId: string;
  layers: TextLayer[];
}

export interface PublicPlayer {
  id: string;
  nickname: string;
  score: number;
  connected: boolean;
  isHost: boolean;
}

export interface RoomSnapshot {
  code: string;
  phase: Phase;
  settings: RoomSettings;
  players: PublicPlayer[];
  currentRound: number;
  totalRounds: number;
  templates: Template[];
}

export const DEFAULT_SETTINGS: RoomSettings = {
  rounds: 3,
  captionTimeSec: 75,
  voteTimeSec: 8,
  templateSource: 'both',
};

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 20;
export const MAX_TEXT_LAYERS = 5;
export const REVEAL_PAUSE_SEC = 3;
export const ROUND_TRANSITION_PAUSE_SEC = 5;
