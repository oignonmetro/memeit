// Empreinte perceptuelle + cryptographique d'une image, extraite de
// templates.mts pour être importable depuis un process qui doit rester en
// vie (boxEditorPlugin.mts, un serveur de dev) — templates.mts se termine
// par process.exit(), l'importer tuerait ce genre de process au chargement.
import { createHash } from 'node:crypto';
import { Jimp } from 'jimp';

const DHASH_SIZE = 16; // 16x16 => 256 bits

export interface Fingerprint {
  sha256: string;
  dhash: string;
  width: number;
  height: number;
}

// dhash : on compare chaque pixel à son voisin de droite sur une vignette en
// niveaux de gris. Insensible à la luminosité globale et à la compression,
// contrairement à un hash cryptographique.
export async function fingerprintBuffer(buf: Buffer): Promise<Fingerprint> {
  const img = await Jimp.read(buf);
  const small = img.clone().greyscale().resize({ w: DHASH_SIZE + 1, h: DHASH_SIZE });
  const { data } = small.bitmap; // RVBA, 4 octets par pixel
  const grey = (row: number, col: number) => data[(row * (DHASH_SIZE + 1) + col) * 4];

  let bits = '';
  for (let row = 0; row < DHASH_SIZE; row += 1) {
    for (let col = 0; col < DHASH_SIZE; col += 1) {
      bits += grey(row, col) < grey(row, col + 1) ? '1' : '0';
    }
  }
  let dhash = '';
  for (let i = 0; i < bits.length; i += 4) dhash += parseInt(bits.slice(i, i + 4), 2).toString(16);

  return {
    sha256: createHash('sha256').update(buf).digest('hex'),
    dhash,
    width: img.bitmap.width,
    height: img.bitmap.height,
  };
}
