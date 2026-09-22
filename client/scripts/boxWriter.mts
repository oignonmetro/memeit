// Réécriture des coordonnées de zones de texte dans les fichiers source.
//
// Les fichiers de packs ne stockent pas leurs zones au même endroit :
//   - classiques.ts : métadonnées seules, zones résolues via CURATED dans
//     templateBoxes.ts (une entrée = une ligne, commentaire en fin de ligne).
//   - pepites.ts et snap.ts : zones écrites en clair dans l'objet du
//     template. Ces deux-là partagent exactement le même format, donc les
//     mêmes fonctions (writePepitesBoxes / deletePepitesEntry, nommées
//     d'après le premier fichier à l'avoir utilisé) les réécrivent toutes
//     les deux — seul le fichier passé en entrée change.
//
// Ces fonctions sont pures (source texte -> source texte) pour être testables
// sans navigateur ni serveur : elles réécrivent un fichier de données, une
// erreur de découpage y serait silencieuse et destructrice.
import type { TemplateBox } from '../src/types.ts';
import type { Fingerprint } from './imageFingerprint.mts';

export function formatBox(b: TemplateBox): string {
  const base = `xPct: ${b.xPct}, yPct: ${b.yPct}, widthPct: ${b.widthPct}, heightPct: ${b.heightPct}`;
  // Omitted when 0/absent: the vast majority of zones aren't rotated, and
  // keeping the field out of those entries means editing an unrelated zone
  // never touches — or reformats — every other line in the file.
  return b.rotationDeg ? `{ ${base}, rotationDeg: ${b.rotationDeg} }` : `{ ${base} }`;
}

// Échappe un id pour l'insérer dans une regex (les ids sont alphanumériques
// aujourd'hui, mais on ne veut pas que ça devienne une faille silencieuse).
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Découpe en lignes sans `\r` de fin (source.split('\n') seul laisse un `\r`
// traînant sur un fichier à fins de ligne Windows, ce qui casse à la fois les
// comparaisons strictes du type `l === '};'` et les `$` de fin de regex — sur
// un checkout Windows/autocrlf, TOUTES les lignes auraient un `\r` final).
// L'EOL détecté est réutilisé à l'écriture pour ne pas transformer un fichier
// CRLF en LF (et produire un diff illisible sur chaque ligne).
function splitLines(source: string): { lines: string[]; eol: '\n' | '\r\n' } {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  return { lines: source.split(/\r?\n/), eol };
}

/**
 * Met à jour (ou crée) l'entrée CURATED d'un template Imgflip dans
 * templateBoxes.ts. Le commentaire de fin de ligne existant est conservé ;
 * pour une nouvelle entrée, le nom du template sert de commentaire.
 */
export function writeCuratedBoxes(
  source: string,
  imgflipId: string,
  boxes: TemplateBox[],
  templateName: string
): string {
  const inline = `[${boxes.map(formatBox).join(', ')}]`;
  const { lines, eol } = splitLines(source);

  const entryRe = new RegExp(`^  '${escapeRe(imgflipId)}': \\[.*\\],(\\s*//.*)?$`);
  const existing = lines.findIndex((l) => entryRe.test(l));

  if (existing !== -1) {
    const comment = lines[existing].match(entryRe)![1] ?? '';
    lines[existing] = `  '${imgflipId}': ${inline},${comment}`;
    return lines.join(eol);
  }

  // Nouvelle entrée : insertion juste avant la fermeture de l'objet CURATED.
  const openIdx = lines.findIndex((l) => l.startsWith('const CURATED'));
  if (openIdx === -1) throw new Error('CURATED introuvable dans templateBoxes.ts');
  const closeIdx = lines.findIndex((l, i) => i > openIdx && l === '};');
  if (closeIdx === -1) throw new Error('Fin de CURATED introuvable dans templateBoxes.ts');

  lines.splice(closeIdx, 0, `  '${imgflipId}': ${inline}, // ${templateName}`);
  return lines.join(eol);
}

/**
 * Supprime l'entrée d'un template Imgflip dans classiques.ts (CLASSIQUES_META,
 * une ligne par entrée). Échoue si l'id est absent : un id inconnu signale un
 * bug côté appelant (le template a déjà disparu, ou n'a jamais existé), pas
 * un no-op silencieux qui masquerait le problème.
 */
export function deleteClassiqueEntry(source: string, imgflipId: string): string {
  const { lines, eol } = splitLines(source);
  const entryRe = new RegExp(`^  \\{ id: '${escapeRe(imgflipId)}',`);
  const idx = lines.findIndex((l) => entryRe.test(l));
  if (idx === -1) throw new Error(`Template ${imgflipId} introuvable dans classiques.ts`);
  lines.splice(idx, 1);
  return lines.join(eol);
}

/**
 * Supprime l'entrée d'un template au format "zones en clair" : tout le bloc,
 * de la ligne "{" qui précède "id: '...'," jusqu'au "}," qui referme l'objet
 * (pas seulement la ligne id, contrairement à classiques.ts où l'entrée est
 * sur une seule ligne).
 *
 * Sert à pepites.ts comme à snap.ts, qui partagent ce format — d'où
 * `fileLabel`, uniquement là pour que le message d'erreur nomme le fichier
 * réellement fouillé plutôt que d'envoyer chercher dans le mauvais.
 */
export function deletePepitesEntry(
  source: string,
  templateId: string,
  fileLabel = 'pepites.ts'
): string {
  const { lines, eol } = splitLines(source);
  const idIdx = lines.findIndex((l) => l.trim() === `id: '${templateId}',`);
  if (idIdx === -1) throw new Error(`Template ${templateId} introuvable dans ${fileLabel}`);
  const startIdx = idIdx - 1;
  if (startIdx < 0 || lines[startIdx].trim() !== '{') {
    throw new Error(`Début d'entrée introuvable pour ${templateId} dans ${fileLabel}`);
  }
  const endIdx = lines.findIndex((l, i) => i > idIdx && l.trim() === '},');
  if (endIdx === -1) throw new Error(`Fin d'entrée introuvable pour ${templateId} dans ${fileLabel}`);
  lines.splice(startIdx, endIdx - startIdx + 1);
  return lines.join(eol);
}

/**
 * Retire l'entrée CURATED d'un template Imgflip si elle existe. Silencieux
 * (retourne la source inchangée) si absente : un template resté sur la
 * disposition générique n'a jamais eu d'entrée à retirer, ce n'est pas une
 * erreur.
 */
export function deleteCuratedBoxes(source: string, imgflipId: string): string {
  const { lines, eol } = splitLines(source);
  const entryRe = new RegExp(`^  '${escapeRe(imgflipId)}': \\[.*\\],(\\s*//.*)?$`);
  const idx = lines.findIndex((l) => entryRe.test(l));
  if (idx === -1) return source;
  lines.splice(idx, 1);
  return lines.join(eol);
}

/**
 * Retire l'empreinte d'un template dans fingerprints.generated.ts. Échoue si
 * absente : gameLogic.test.mts exige que le nombre d'empreintes égale
 * exactement le nombre de templates des packs — laisser une entrée orpheline
 * (silencieuse ici) ferait échouer ce test ailleurs, pour une raison bien
 * moins évidente à retrouver que l'erreur immédiate levée ici.
 */
export function deleteFingerprintEntry(source: string, fullId: string): string {
  const { lines, eol } = splitLines(source);
  const entryRe = new RegExp(`^  '${escapeRe(fullId)}': \\{`);
  const idx = lines.findIndex((l) => entryRe.test(l));
  if (idx === -1) throw new Error(`Empreinte ${fullId} introuvable dans fingerprints.generated.ts`);
  lines.splice(idx, 1);
  return lines.join(eol);
}

/**
 * Met à jour (ou crée) l'empreinte d'un template dans
 * fingerprints.generated.ts. Sert après une incrustation de sous-titres dans
 * l'éditeur visuel : l'image change sur disque, son empreinte doit suivre
 * sans attendre le prochain `npm run templates:fingerprint` complet.
 */
export function upsertFingerprintEntry(source: string, fullId: string, fingerprint: Fingerprint): string {
  const { lines, eol } = splitLines(source);
  const entry = `  '${fullId}': { sha256: '${fingerprint.sha256}', dhash: '${fingerprint.dhash}', width: ${fingerprint.width}, height: ${fingerprint.height} },`;

  const entryRe = new RegExp(`^  '${escapeRe(fullId)}': \\{`);
  const idx = lines.findIndex((l) => entryRe.test(l));
  if (idx !== -1) {
    lines[idx] = entry;
    return lines.join(eol);
  }

  const closeIdx = lines.findIndex((l) => l === '};');
  if (closeIdx === -1) throw new Error('Fin de TEMPLATE_FINGERPRINTS introuvable dans fingerprints.generated.ts');
  lines.splice(closeIdx, 0, entry);
  return lines.join(eol);
}

/**
 * Met à jour les zones d'un template au format "zones en clair" (pepites.ts,
 * snap.ts). Reproduit la convention du fichier : une seule zone tient sur une
 * ligne, deux zones ou plus sont réparties une par ligne. `fileLabel` ne sert
 * qu'aux messages d'erreur, pour nommer le fichier réellement fouillé.
 */
export function writePepitesBoxes(
  source: string,
  templateId: string,
  boxes: TemplateBox[],
  fileLabel = 'pepites.ts'
): string {
  const { lines, eol } = splitLines(source);

  const idIdx = lines.findIndex((l) => l.trim() === `id: '${templateId}',`);
  if (idIdx === -1) throw new Error(`Template ${templateId} introuvable dans ${fileLabel}`);

  const startIdx = lines.findIndex((l, i) => i > idIdx && l.trimStart().startsWith('boxes: ['));
  if (startIdx === -1) throw new Error(`Zones de ${templateId} introuvables dans ${fileLabel}`);

  // Une entrée sur une seule ligne se termine par "],", sinon on avance
  // jusqu'à la ligne de fermeture du tableau.
  let endIdx = startIdx;
  if (!lines[startIdx].trimEnd().endsWith('],')) {
    endIdx = lines.findIndex((l, i) => i > startIdx && l.trim() === '],');
    if (endIdx === -1) throw new Error(`Fin des zones de ${templateId} introuvable dans ${fileLabel}`);
  }

  const replacement =
    boxes.length === 1
      ? [`    boxes: [${formatBox(boxes[0])}],`]
      : ['    boxes: [', ...boxes.map((b) => `      ${formatBox(b)},`), '    ],'];

  lines.splice(startIdx, endIdx - startIdx + 1, ...replacement);
  return lines.join(eol);
}
