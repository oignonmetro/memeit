import { useSyncExternalStore } from 'react';
import { isChatVisible, subscribeChatVisibility } from '../lib/chatVisibility';

export function useChatVisible(): boolean {
  return useSyncExternalStore(subscribeChatVisibility, isChatVisible);
}
