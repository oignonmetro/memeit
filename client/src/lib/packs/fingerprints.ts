// Empreintes visuelles des templates intégrés — la protection anti-doublon.
//
// Deux entrées peuvent désigner le MÊME meme tout en ayant un id, une URL et
// un nom différents (c'est arrivé : "Is This A Pigeon" et "is this butterfly"
// pointaient vers le même fichier sous deux ids Imgflip). Comparer les
// métadonnées ne suffit donc pas : on compare l'image elle-même.
//
// Les empreintes sont calculées une fois, à l'import (`npm run
// templates:fingerprint`), et figées dans fingerprints.generated.ts. Le test
// les relit hors-ligne et instantanément — aucun téléchargement au moment de
// lancer les tests ou de builder l'appli.
//
// Rien dans le code de l'appli n'importe ce module : il ne part pas dans le
// bundle, il ne sert qu'à l'outillage et aux tests.

import { TEMPLATE_FINGERPRINTS } from './fingerprints.generated';

export type { TemplateFingerprint } from './fingerprints.generated';
export { TEMPLATE_FINGERPRINTS } from './fingerprints.generated';

// dhash 16x16 : 256 bits, sérialisés en 64 caractères hexadécimaux.
export const DHASH_BITS = 256;

// Deux images distinctes restent très éloignées (la paire de memes différents
// la plus proche des packs actuels est à 47 bits), alors qu'un ré-encodage ou
// un redimensionnement du même visuel reste sous la dizaine. 16 laisse donc
// une marge confortable des deux côtés.
export const DHASH_DUPLICATE_MAX_DISTANCE = 16;

const HEX_BIT_COUNT: Record<string, number> = {
  '0': 0, '1': 1, '2': 1, '3': 2, '4': 1, '5': 2, '6': 2, '7': 3,
  '8': 1, '9': 2, a: 2, b: 3, c: 2, d: 3, e: 3, f: 4,
};

// Distance de Hamming entre deux dhash hexadécimaux (nombre de bits qui
// diffèrent). 0 = images visuellement identiques.
export function dhashDistance(a: string, b: string): number {
  if (a.length !== b.length) throw new Error(`dhash de longueurs différentes (${a.length} vs ${b.length})`);
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === b[i]) continue;
    const xor = (parseInt(a[i], 16) ^ parseInt(b[i], 16)).toString(16);
    distance += HEX_BIT_COUNT[xor];
  }
  return distance;
}

export interface DuplicateHit {
  againstId: string;
  reason: 'sha256' | 'dhash';
  distance: number;
}

// Cherche, parmi les empreintes déjà connues, celle qui désigne la même image.
// `skipId` permet d'ignorer l'entrée elle-même quand on contrôle un pack
// existant. Renvoie null si l'image est inédite.
export function findDuplicate(
  fingerprint: { sha256: string; dhash: string },
  known: Record<string, { sha256: string; dhash: string }> = TEMPLATE_FINGERPRINTS,
  skipId?: string
): DuplicateHit | null {
  for (const [id, other] of Object.entries(known)) {
    if (id === skipId) continue;
    // Fichier strictement identique : certitude, pas de seuil à discuter.
    if (other.sha256 === fingerprint.sha256) return { againstId: id, reason: 'sha256', distance: 0 };
    // Même visuel ré-encodé / redimensionné : on retombe sur le dhash.
    const distance = dhashDistance(other.dhash, fingerprint.dhash);
    if (distance <= DHASH_DUPLICATE_MAX_DISTANCE) return { againstId: id, reason: 'dhash', distance };
  }
  return null;
}
