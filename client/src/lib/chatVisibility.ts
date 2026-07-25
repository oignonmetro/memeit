// Per-device preference (localStorage) for showing/hiding the chat button,
// with a tiny pub/sub so a change re-renders React in the same tab.
const STORAGE_KEY = 'memeit:chat-hidden';
const listeners = new Set<() => void>();

export function isChatVisible(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== 'hidden';
}

export function setChatVisible(visible: boolean): void {
  localStorage.setItem(STORAGE_KEY, visible ? 'shown' : 'hidden');
  listeners.forEach((listener) => listener());
}

export function subscribeChatVisibility(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
