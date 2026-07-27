// Optional per-device default nickname, remembered across sessions.
const STORAGE_KEY = 'memeit:default-nickname';

export function getDefaultNickname(): string {
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function setDefaultNickname(nickname: string): void {
  localStorage.setItem(STORAGE_KEY, nickname);
}

export function clearDefaultNickname(): void {
  localStorage.removeItem(STORAGE_KEY);
}
