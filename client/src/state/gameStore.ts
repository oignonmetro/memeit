import { create } from 'zustand';
import {
  subscribeRoom,
  subscribeTemplates,
  createRoom as apiCreateRoom,
  joinRoom as apiJoinRoom,
  joinTv as apiJoinTv,
  leaveRoomLobby,
  markConnected,
  addCustomTemplate,
  startGame as apiStartGame,
  submitMeme as apiSubmitMeme,
  castFavorite as apiCastFavorite,
  setCaptionTime as apiSetCaptionTime,
  setMode as apiSetMode,
  maybeAdvanceFromCaption,
  advanceReveal,
  maybeTallyVotes,
  advanceAfterRoundResults,
  cleanupIfInactive,
} from '../lib/roomApi';
import { getOrCreatePlayerId } from '../lib/playerId';
import { getPopularTemplates } from '../lib/imgflip';
import { deriveView, type DerivedView } from '../lib/deriveView';
import type { DbRoom, DbTemplates, GameMode, RoomSettings, Template } from '../types';
import { ROUND_TRANSITION_PAUSE_SEC } from '../types';

type Role = 'player' | 'tv' | null;

const TICK_MS = 1000;
const CLEANUP_EVERY_N_TICKS = 60;

interface GameState extends DerivedView {
  selfId: string;
  role: Role;
  code: string | null;
  error: string | null;
  loaded: boolean;

  clearError: () => void;

  createRoom: (nickname: string, settings?: Partial<RoomSettings>) => Promise<string>;
  joinRoom: (code: string, nickname: string) => Promise<void>;
  joinTv: (code: string) => Promise<void>;
  attachRoom: (code: string, role: Role) => void;
  detachRoom: () => void;
  startGame: () => Promise<void>;
  setCaptionTime: (seconds: number) => Promise<void>;
  setMode: (mode: GameMode) => Promise<void>;
  uploadTemplate: (dataUrl: string) => Promise<void>;
  submitMeme: (layers: import('../types').TextLayer[]) => Promise<void>;
  castFavorite: (authorId: string) => Promise<void>;
  leaveRoom: () => void;
}

let unsubRoom: (() => void) | null = null;
let unsubTemplates: (() => void) | null = null;
let tickHandle: ReturnType<typeof setInterval> | null = null;
let tickCount = 0;
let latestDbRoom: DbRoom | null = null;
let latestDbTemplates: DbTemplates = {};
let latestLibraryTemplates: Template[] = [];

function stopLoops() {
  if (unsubRoom) {
    unsubRoom();
    unsubRoom = null;
  }
  if (unsubTemplates) {
    unsubTemplates();
    unsubTemplates = null;
  }
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
  latestDbRoom = null;
  latestDbTemplates = {};
  tickCount = 0;
}

function driveGameForward(code: string) {
  const room = latestDbRoom;
  if (!room) return;

  if (room.status === 'caption') {
    if (room.roundDeadline != null && Date.now() >= room.roundDeadline) {
      maybeAdvanceFromCaption(code);
    }
  } else if (room.status === 'reveal') {
    if (room.revealDeadline != null && Date.now() >= room.revealDeadline) {
      advanceReveal(code);
    }
  } else if (room.status === 'vote') {
    if (room.voteDeadline != null && Date.now() >= room.voteDeadline) {
      maybeTallyVotes(code);
    }
  } else if (room.status === 'round_results') {
    if (Date.now() - (room.lastActivityAt || 0) >= ROUND_TRANSITION_PAUSE_SEC * 1000) {
      advanceAfterRoundResults(code);
    }
  }

  tickCount += 1;
  if (tickCount % CLEANUP_EVERY_N_TICKS === 0) {
    cleanupIfInactive(code);
  }
}

export const useGameStore = create<GameState>((set, get) => ({
  selfId: getOrCreatePlayerId(),
  role: null,
  code: null,
  error: null,
  loaded: false,
  room: null,
  roundStarted: null,
  captionProgress: null,
  revealMeme: null,
  voteState: null,
  roundScoreboard: null,
  gameEnded: null,
  hasSubmitted: false,

  clearError: () => set({ error: null }),

  attachRoom: (code, role) => {
    stopLoops();
    tickCount = 0;
    set({ code, role, loaded: false, error: null });
    const selfId = get().selfId;

    unsubRoom = subscribeRoom(code, (room) => {
      latestDbRoom = room;
      if (role === 'player' && room && room.players?.[selfId] && !room.players[selfId].connected) {
        markConnected(code, selfId).catch(() => {});
      }
      set({ ...deriveView(code, room, latestDbTemplates, latestLibraryTemplates, selfId), loaded: true });
    });
    unsubTemplates = subscribeTemplates(code, (templates) => {
      latestDbTemplates = templates;
      set({ ...deriveView(code, latestDbRoom, templates, latestLibraryTemplates, selfId) });
    });
    getPopularTemplates().then((templates) => {
      latestLibraryTemplates = templates;
      if (get().code === code) {
        set({ ...deriveView(code, latestDbRoom, latestDbTemplates, templates, selfId) });
      }
    });
    tickHandle = setInterval(() => driveGameForward(code), TICK_MS);
  },

  detachRoom: () => {
    stopLoops();
    set({ code: null, role: null, loaded: false });
  },

  createRoom: async (nickname, settings) => {
    const selfId = get().selfId;
    const code = await apiCreateRoom(selfId, nickname.trim(), settings || {});
    get().attachRoom(code, 'player');
    return code;
  },

  joinRoom: async (code, nickname) => {
    const selfId = get().selfId;
    await apiJoinRoom(code, selfId, nickname.trim());
    get().attachRoom(code.toUpperCase(), 'player');
  },

  joinTv: async (code) => {
    await apiJoinTv(code);
    get().attachRoom(code.toUpperCase(), 'tv');
  },

  startGame: async () => {
    const { code } = get();
    if (!code) return;
    await apiStartGame(code);
  },

  setCaptionTime: async (seconds) => {
    const { code } = get();
    if (!code) return;
    await apiSetCaptionTime(code, seconds);
  },

  setMode: async (mode) => {
    const { code } = get();
    if (!code) return;
    await apiSetMode(code, mode);
  },

  uploadTemplate: async (dataUrl) => {
    const { code } = get();
    if (!code) return;
    await addCustomTemplate(code, dataUrl);
  },

  submitMeme: async (layers) => {
    const { code, selfId } = get();
    if (!code) return;
    await apiSubmitMeme(code, selfId, layers);
  },

  castFavorite: async (authorId) => {
    const { code, selfId } = get();
    if (!code) return;
    await apiCastFavorite(code, selfId, authorId);
  },

  leaveRoom: () => {
    const { code, selfId, role } = get();
    if (code && role === 'player') {
      leaveRoomLobby(code, selfId).catch(() => {});
    }
    stopLoops();
    set({
      role: null,
      code: null,
      loaded: false,
      room: null,
      roundStarted: null,
      captionProgress: null,
      revealMeme: null,
      voteState: null,
      roundScoreboard: null,
      gameEnded: null,
      hasSubmitted: false,
    });
  },
}));
