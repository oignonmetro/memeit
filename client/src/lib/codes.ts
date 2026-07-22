const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // pas de 0/O ni 1/I

function randomCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export function generateRoomCode(): string {
  return randomCode(4);
}
