import type { Server } from 'socket.io';
import {
  Phase,
  RoomSettings,
  Player,
  Meme,
  Template,
  TextLayer,
  RoomSnapshot,
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MAX_TEXT_LAYERS,
  REVEAL_PAUSE_SEC,
  ROUND_TRANSITION_PAUSE_SEC,
} from '../types.js';
import { LIBRARY_TEMPLATES } from '../templates/library.js';
import { generateId, generateToken } from '../utils/code.js';
import { EVENTS } from '../socket/events.js';

interface InternalPlayer extends Player {
  socketId: string | null;
  token: string;
}

interface RevealItem {
  meme: Meme;
  upvoters: Set<string>;
  acted: Set<string>;
  resolved: boolean;
}

export class Room {
  readonly code: string;
  private io: Server;
  settings: RoomSettings;
  phase: Phase = 'lobby';
  players = new Map<string, InternalPlayer>();
  viewers = new Set<string>();
  customTemplates: Template[] = [];
  currentRound = 0;
  currentTemplateId: string | null = null;
  submissions = new Map<string, Meme>();
  revealQueue: RevealItem[] = [];
  revealIndex = -1;
  private phaseTimer: NodeJS.Timeout | null = null;
  private pendingTemplateIds: string[] = [];
  createdAt = Date.now();
  lastActivity = Date.now();

  private lastRoundStartedPayload: any = null;
  private lastRevealPayload: any = null;
  private lastScoreboardPayload: any = null;
  private lastGameEndedPayload: any = null;

  constructor(code: string, io: Server, settings: Partial<RoomSettings> = {}) {
    this.code = code;
    this.io = io;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
  }

  private touch() {
    this.lastActivity = Date.now();
  }

  // ---------- players & viewers ----------

  addPlayer(nickname: string, socketId: string): InternalPlayer {
    const isHost = this.players.size === 0;
    const player: InternalPlayer = {
      id: generateId(),
      nickname: nickname.slice(0, 20) || 'Joueur',
      score: 0,
      connected: true,
      isHost,
      socketId,
      token: generateToken(),
    };
    this.players.set(player.id, player);
    this.touch();
    return player;
  }

  rejoinPlayer(playerId: string, token: string, socketId: string): InternalPlayer | null {
    const player = this.players.get(playerId);
    if (!player || player.token !== token) return null;
    player.socketId = socketId;
    player.connected = true;
    this.touch();
    return player;
  }

  addViewer(socketId: string) {
    this.viewers.add(socketId);
  }

  removeViewer(socketId: string) {
    this.viewers.delete(socketId);
  }

  findPlayerBySocket(socketId: string): InternalPlayer | undefined {
    for (const p of this.players.values()) {
      if (p.socketId === socketId) return p;
    }
    return undefined;
  }

  disconnectSocket(socketId: string) {
    if (this.viewers.has(socketId)) {
      this.viewers.delete(socketId);
      return;
    }
    const player = this.findPlayerBySocket(socketId);
    if (!player) return;
    player.connected = false;
    player.socketId = null;
    // If nobody joined yet / still in lobby, drop the seat entirely.
    if (this.phase === 'lobby') {
      this.players.delete(player.id);
      if (player.isHost && this.players.size > 0) {
        const next = [...this.players.values()][0];
        next.isHost = true;
      }
    }
    this.touch();
    this.broadcastRoomUpdate();
  }

  get connectedPlayers(): InternalPlayer[] {
    return [...this.players.values()].filter((p) => p.connected);
  }

  isEmpty(): boolean {
    return this.connectedPlayers.length === 0 && this.viewers.size === 0;
  }

  // ---------- templates ----------

  addCustomTemplate(dataUrl: string): Template | null {
    if (this.phase !== 'lobby') return null;
    if (this.customTemplates.length >= 30) return null;
    const template: Template = {
      id: `up-${generateId()}`,
      url: dataUrl,
      name: 'Template perso',
      source: 'upload',
    };
    this.customTemplates.push(template);
    this.touch();
    return template;
  }

  private get availableTemplates(): Template[] {
    const { templateSource } = this.settings;
    if (templateSource === 'library') return LIBRARY_TEMPLATES;
    if (templateSource === 'upload') return this.customTemplates.length ? this.customTemplates : LIBRARY_TEMPLATES;
    return [...LIBRARY_TEMPLATES, ...this.customTemplates];
  }

  private getTemplateById(id: string): Template | undefined {
    return this.availableTemplates.find((t) => t.id === id) ?? this.customTemplates.find((t) => t.id === id);
  }

  private pickNextTemplateId(): string {
    if (this.pendingTemplateIds.length === 0) {
      const pool = this.availableTemplates.map((t) => t.id);
      this.pendingTemplateIds = shuffle(pool);
    }
    return this.pendingTemplateIds.pop()!;
  }

  // ---------- snapshot ----------

  snapshot(): RoomSnapshot {
    return {
      code: this.code,
      phase: this.phase,
      settings: this.settings,
      players: [...this.players.values()]
        .map((p) => ({ id: p.id, nickname: p.nickname, score: p.score, connected: p.connected, isHost: p.isHost }))
        .sort((a, b) => b.score - a.score),
      currentRound: this.currentRound,
      totalRounds: this.settings.rounds,
      templates: [...LIBRARY_TEMPLATES, ...this.customTemplates],
    };
  }

  broadcastRoomUpdate() {
    this.io.to(this.roomChannel).emit(EVENTS.ROOM_UPDATE, this.snapshot());
  }

  private get roomChannel() {
    return `room:${this.code}`;
  }

  sendResumePayload(socketId: string) {
    this.io.to(socketId).emit(EVENTS.ROOM_UPDATE, this.snapshot());
    if (this.phase === 'caption' && this.lastRoundStartedPayload) {
      this.io.to(socketId).emit(EVENTS.ROUND_STARTED, this.lastRoundStartedPayload);
    } else if (this.phase === 'voting' && this.lastRevealPayload) {
      this.io.to(socketId).emit(EVENTS.REVEAL_MEME, this.lastRevealPayload);
    } else if (this.phase === 'round_results' && this.lastScoreboardPayload) {
      this.io.to(socketId).emit(EVENTS.ROUND_SCOREBOARD, this.lastScoreboardPayload);
    } else if (this.phase === 'ended' && this.lastGameEndedPayload) {
      this.io.to(socketId).emit(EVENTS.GAME_ENDED, this.lastGameEndedPayload);
    }
  }

  // ---------- game flow ----------

  canStart(): boolean {
    return this.phase === 'lobby' && this.connectedPlayers.length >= 2;
  }

  startGame() {
    if (!this.canStart()) return;
    this.currentRound = 0;
    for (const p of this.players.values()) p.score = 0;
    this.startRound();
  }

  private startRound() {
    this.clearTimer();
    this.currentRound += 1;
    this.submissions.clear();
    this.revealQueue = [];
    this.revealIndex = -1;
    this.currentTemplateId = this.pickNextTemplateId();
    this.phase = 'caption';
    const template = this.getTemplateById(this.currentTemplateId);
    const deadline = Date.now() + this.settings.captionTimeSec * 1000;

    this.lastRoundStartedPayload = {
      roundNumber: this.currentRound,
      totalRounds: this.settings.rounds,
      template,
      deadline,
    };
    this.broadcastRoomUpdate();
    this.io.to(this.roomChannel).emit(EVENTS.ROUND_STARTED, this.lastRoundStartedPayload);

    this.phaseTimer = setTimeout(() => this.endCaptionPhase(), this.settings.captionTimeSec * 1000);
    this.touch();
  }

  submitMeme(playerId: string, templateId: string, layers: TextLayer[]): { ok: boolean; error?: string; memeId?: string } {
    if (this.phase !== 'caption') return { ok: false, error: 'Ce n\'est pas le moment de soumettre.' };
    if (templateId !== this.currentTemplateId) return { ok: false, error: 'Template invalide.' };
    const player = this.players.get(playerId);
    if (!player) return { ok: false, error: 'Joueur inconnu.' };
    const cleanLayers = (layers || []).slice(0, MAX_TEXT_LAYERS).map((l) => ({
      id: l.id || generateId(),
      text: String(l.text || '').slice(0, 120),
      xPct: clamp(l.xPct, 0, 100),
      yPct: clamp(l.yPct, 0, 100),
      fontSize: (['sm', 'md', 'lg'] as const).includes(l.fontSize) ? l.fontSize : 'md',
      color: /^#[0-9a-fA-F]{6}$/.test(l.color) ? l.color : '#ffffff',
    }));
    const memeId = generateId();
    this.submissions.set(playerId, {
      id: memeId,
      authorId: playerId,
      templateId,
      layers: cleanLayers,
    });
    this.touch();

    const total = this.connectedPlayers.length;
    this.io.to(this.roomChannel).emit(EVENTS.CAPTION_PROGRESS, { submitted: this.submissions.size, total });

    if (this.submissions.size >= total) {
      this.endCaptionPhase();
    }
    return { ok: true, memeId };
  }

  private endCaptionPhase() {
    if (this.phase !== 'caption') return;
    this.clearTimer();
    // Auto-fill empty memes for anyone who didn't submit in time.
    for (const p of this.connectedPlayers) {
      if (!this.submissions.has(p.id)) {
        this.submissions.set(p.id, {
          id: generateId(),
          authorId: p.id,
          templateId: this.currentTemplateId!,
          layers: [],
        });
      }
    }
    this.startVoting();
  }

  private startVoting() {
    this.phase = 'voting';
    const memes = shuffle([...this.submissions.values()]);
    this.revealQueue = memes.map((meme) => ({ meme, upvoters: new Set(), acted: new Set(), resolved: false }));
    this.revealIndex = -1;
    this.broadcastRoomUpdate();
    this.revealNext();
  }

  private revealNext() {
    this.clearTimer();
    this.revealIndex += 1;
    if (this.revealIndex >= this.revealQueue.length) {
      this.endRound();
      return;
    }
    const item = this.revealQueue[this.revealIndex];
    const deadline = Date.now() + this.settings.voteTimeSec * 1000;
    this.lastRevealPayload = {
      index: this.revealIndex,
      total: this.revealQueue.length,
      meme: { id: item.meme.id, templateId: item.meme.templateId, layers: item.meme.layers },
      deadline,
    };
    this.io.to(this.roomChannel).emit(EVENTS.REVEAL_MEME, this.lastRevealPayload);
    this.phaseTimer = setTimeout(() => this.resolveCurrentReveal(), this.settings.voteTimeSec * 1000);
  }

  castVote(voterId: string, memeId: string, thumbsUp: boolean): { ok: boolean; error?: string } {
    if (this.phase !== 'voting') return { ok: false, error: 'Ce n\'est pas le moment de voter.' };
    const item = this.revealQueue[this.revealIndex];
    if (!item || item.meme.id !== memeId || item.resolved) return { ok: false, error: 'Ce meme n\'est plus soumis au vote.' };
    if (item.meme.authorId === voterId) return { ok: false, error: 'Tu ne peux pas voter pour ton propre meme.' };
    if (!this.players.has(voterId)) return { ok: false, error: 'Joueur inconnu.' };
    if (item.acted.has(voterId)) return { ok: false, error: 'Tu as déjà voté.' };
    item.acted.add(voterId);
    if (thumbsUp) item.upvoters.add(voterId);
    this.touch();

    const eligible = this.connectedPlayers.filter((p) => p.id !== item.meme.authorId).length;
    if (item.acted.size >= eligible) {
      this.resolveCurrentReveal();
    }
    return { ok: true };
  }

  private resolveCurrentReveal() {
    const item = this.revealQueue[this.revealIndex];
    if (!item || item.resolved) return;
    this.clearTimer();
    item.resolved = true;
    const author = this.players.get(item.meme.authorId);
    const thumbsUp = item.upvoters.size;
    if (author) author.score += thumbsUp;
    this.io.to(this.roomChannel).emit(EVENTS.REVEAL_RESULT, {
      memeId: item.meme.id,
      authorId: item.meme.authorId,
      authorNickname: author?.nickname ?? '???',
      thumbsUp,
    });
    this.phaseTimer = setTimeout(() => this.revealNext(), REVEAL_PAUSE_SEC * 1000);
  }

  private endRound() {
    this.phase = 'round_results';
    this.lastScoreboardPayload = {
      roundNumber: this.currentRound,
      totalRounds: this.settings.rounds,
      scores: this.snapshot().players,
    };
    this.broadcastRoomUpdate();
    this.io.to(this.roomChannel).emit(EVENTS.ROUND_SCOREBOARD, this.lastScoreboardPayload);

    this.phaseTimer = setTimeout(() => {
      if (this.currentRound >= this.settings.rounds) {
        this.endGame();
      } else {
        this.startRound();
      }
    }, ROUND_TRANSITION_PAUSE_SEC * 1000);
  }

  private endGame() {
    this.phase = 'ended';
    const scores = this.snapshot().players;
    this.lastGameEndedPayload = {
      scores,
      winnerId: scores[0]?.id ?? null,
    };
    this.broadcastRoomUpdate();
    this.io.to(this.roomChannel).emit(EVENTS.GAME_ENDED, this.lastGameEndedPayload);
  }

  private clearTimer() {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }

  destroy() {
    this.clearTimer();
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(n: number, min: number, max: number): number {
  const v = typeof n === 'number' && !Number.isNaN(n) ? n : (min + max) / 2;
  return Math.min(max, Math.max(min, v));
}
