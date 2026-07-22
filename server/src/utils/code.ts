import { customAlphabet } from 'nanoid';

// No 0/O/1/I to avoid ambiguity when players read the code off a TV screen.
const nanoidCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4);
const nanoidId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);
const nanoidToken = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 24);

export function generateRoomCode(): string {
  return nanoidCode();
}

export function generateId(): string {
  return nanoidId();
}

export function generateToken(): string {
  return nanoidToken();
}
