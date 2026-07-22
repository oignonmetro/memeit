import { create } from 'zustand';
import { getSocket, emitAck } from '../lib/socket';
import { EVENTS } from '../lib/events';
import { saveSession, loadSession, clearSession } from '../lib/session';
import type {
  RoomSnapshot,
  SelfPlayer,
  RoundStartedPayload,
  RevealMemePayload,
  RevealResultPayload,
  RoundScoreboardPayload,
  GameEndedPayload,
  TextLayer,
} from '../types';

type Role = 'player' | 'tv' | null;

interface GameState {
  connected: boolean;
  role: Role;
  room: RoomSnapshot | null;
  self: SelfPlayer | null;
  roundStarted: RoundStartedPayload | null;
  captionProgress: { submitted: number; total: number } | null;
  revealMeme: RevealMemePayload | null;
  lastResult: RevealResultPayload | null;
  roundScoreboard: RoundScoreboardPayload | null;
  gameEnded: GameEndedPayload | null;
  error: string | null;
  hasSubmitted: boolean;
  hasVotedCurrent: boolean;
  myMemeId: string | null;

  listenersReady: boolean;
  initListeners: () => void;
  clearError: () => void;

  createRoom: (nickname: string, settings?: Partial<RoomSnapshot['settings']>) => Promise<string>;
  joinRoom: (code: string, nickname: string) => Promise<void>;
  joinTv: (code: string) => Promise<void>;
  tryRejoin: (code: string) => Promise<boolean>;
  startGame: () => Promise<void>;
  uploadTemplate: (dataUrl: string) => Promise<void>;
  submitMeme: (templateId: string, layers: TextLayer[]) => Promise<void>;
  castVote: (memeId: string, thumbsUp: boolean) => Promise<void>;
  leaveRoom: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  connected: false,
  role: null,
  room: null,
  self: null,
  roundStarted: null,
  captionProgress: null,
  revealMeme: null,
  lastResult: null,
  roundScoreboard: null,
  gameEnded: null,
  error: null,
  hasSubmitted: false,
  hasVotedCurrent: false,
  myMemeId: null,
  listenersReady: false,

  clearError: () => set({ error: null }),

  initListeners: () => {
    if (get().listenersReady) return;
    const socket = getSocket();

    socket.on('connect', () => set({ connected: true }));
    socket.on('disconnect', () => set({ connected: false }));

    socket.on(EVENTS.ROOM_UPDATE, (room: RoomSnapshot) => set({ room }));

    socket.on(EVENTS.ROUND_STARTED, (payload: RoundStartedPayload) =>
      set({
        roundStarted: payload,
        captionProgress: null,
        revealMeme: null,
        lastResult: null,
        roundScoreboard: null,
        hasSubmitted: false,
        hasVotedCurrent: false,
        myMemeId: null,
      })
    );

    socket.on(EVENTS.CAPTION_PROGRESS, (payload: { submitted: number; total: number }) =>
      set({ captionProgress: payload })
    );

    socket.on(EVENTS.REVEAL_MEME, (payload: RevealMemePayload) =>
      set({ revealMeme: payload, lastResult: null, hasVotedCurrent: false })
    );

    socket.on(EVENTS.REVEAL_RESULT, (payload: RevealResultPayload) => set({ lastResult: payload }));

    socket.on(EVENTS.ROUND_SCOREBOARD, (payload: RoundScoreboardPayload) =>
      set({ roundScoreboard: payload, revealMeme: null })
    );

    socket.on(EVENTS.GAME_ENDED, (payload: GameEndedPayload) => set({ gameEnded: payload }));

    socket.on(EVENTS.ERROR_MESSAGE, (payload: { message: string }) => set({ error: payload?.message || 'Erreur' }));

    set({ listenersReady: true });
  },

  createRoom: async (nickname, settings) => {
    const res = await emitAck<{ code: string; player: SelfPlayer; room: RoomSnapshot }>(EVENTS.CREATE_ROOM, {
      nickname,
      settings,
    });
    saveSession({ code: res.code, playerId: res.player.id, token: res.player.token, nickname });
    set({ role: 'player', self: res.player, room: res.room });
    return res.code;
  },

  joinRoom: async (code, nickname) => {
    const res = await emitAck<{ code: string; player: SelfPlayer; room: RoomSnapshot }>(EVENTS.JOIN_ROOM, {
      code,
      nickname,
    });
    saveSession({ code: res.code, playerId: res.player.id, token: res.player.token, nickname });
    set({ role: 'player', self: res.player, room: res.room });
  },

  joinTv: async (code) => {
    const res = await emitAck<{ code: string; room: RoomSnapshot }>(EVENTS.JOIN_TV, { code });
    set({ role: 'tv', room: res.room });
  },

  tryRejoin: async (code) => {
    const session = loadSession();
    if (!session || session.code.toUpperCase() !== code.toUpperCase()) return false;
    try {
      const res = await emitAck<{ code: string; player: SelfPlayer; room: RoomSnapshot }>(EVENTS.REJOIN_ROOM, {
        code: session.code,
        playerId: session.playerId,
        token: session.token,
      });
      set({ role: 'player', self: res.player, room: res.room });
      return true;
    } catch {
      clearSession();
      return false;
    }
  },

  startGame: async () => {
    await emitAck(EVENTS.START_GAME, {});
  },

  uploadTemplate: async (dataUrl) => {
    await emitAck(EVENTS.UPLOAD_TEMPLATE, { dataUrl });
  },

  submitMeme: async (templateId, layers) => {
    const res = await emitAck<{ memeId: string }>(EVENTS.SUBMIT_MEME, { templateId, layers });
    set({ hasSubmitted: true, myMemeId: res.memeId });
  },

  castVote: async (memeId, thumbsUp) => {
    await emitAck(EVENTS.CAST_VOTE, { memeId, thumbsUp });
    set({ hasVotedCurrent: true });
  },

  leaveRoom: () => {
    getSocket().emit(EVENTS.LEAVE_ROOM, {});
    clearSession();
    set({
      role: null,
      room: null,
      self: null,
      roundStarted: null,
      captionProgress: null,
      revealMeme: null,
      lastResult: null,
      roundScoreboard: null,
      gameEnded: null,
      hasSubmitted: false,
      hasVotedCurrent: false,
      myMemeId: null,
    });
  },
}));
