// Socket.io event name constants. Keep in sync with client/src/lib/events.ts.
export const EVENTS = {
  // client -> server
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  JOIN_TV: 'join_tv',
  REJOIN_ROOM: 'rejoin_room',
  START_GAME: 'start_game',
  UPLOAD_TEMPLATE: 'upload_template',
  SUBMIT_MEME: 'submit_meme',
  CAST_VOTE: 'cast_vote',
  LEAVE_ROOM: 'leave_room',

  // server -> client
  ROOM_UPDATE: 'room_update',
  ROUND_STARTED: 'round_started',
  CAPTION_PROGRESS: 'caption_progress',
  REVEAL_MEME: 'reveal_meme',
  REVEAL_RESULT: 'reveal_result',
  ROUND_SCOREBOARD: 'round_scoreboard',
  GAME_ENDED: 'game_ended',
  ERROR_MESSAGE: 'error_message',
} as const;
