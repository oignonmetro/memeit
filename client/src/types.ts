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

export interface RoomSnapshot {
  code: string;
  phase: Phase;
  settings: RoomSettings;
  players: PublicPlayer[];
  currentRound: number;
  totalRounds: number;
  templates: Template[];
}

export interface SelfPlayer extends PublicPlayer {
  token: string;
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
  meme: { id: string; templateId: string; layers: TextLayer[] };
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
