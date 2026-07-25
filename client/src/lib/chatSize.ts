// Per-device preference (localStorage) for the chat panel height, with a tiny
// pub/sub so a change re-renders React in the same tab.
export type ChatSize = 'small' | 'large';

const STORAGE_KEY = 'memeit:chat-size';
const listeners = new Set<() => void>();

export function getChatSize(): ChatSize {
  return localStorage.getItem(STORAGE_KEY) === 'large' ? 'large' : 'small';
}

export function setChatSize(size: ChatSize): void {
  localStorage.setItem(STORAGE_KEY, size);
  listeners.forEach((listener) => listener());
}

export function subscribeChatSize(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
