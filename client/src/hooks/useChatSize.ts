import { useSyncExternalStore } from 'react';
import { getChatSize, subscribeChatSize, type ChatSize } from '../lib/chatSize';

export function useChatSize(): ChatSize {
  return useSyncExternalStore(subscribeChatSize, getChatSize);
}
