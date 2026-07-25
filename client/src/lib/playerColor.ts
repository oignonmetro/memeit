import { PLAYER_PALETTE } from '../types';

// Stable, predictable colour per player: driven by their arrival order in the
// room (not a hash of the id), so it stays consistent across every screen.
export function playerColor(order: string[], playerId: string): string {
  const i = order.indexOf(playerId);
  return PLAYER_PALETTE[(i < 0 ? 0 : i) % PLAYER_PALETTE.length];
}
