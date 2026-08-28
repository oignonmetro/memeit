// Réécriture des coordonnées de zones de texte dans les fichiers source.
//
// Les deux packs ne stockent pas leurs zones au même endroit :
//   - Classiques : métadonnées seules, zones résolues via CURATED dans
//     templateBoxes.ts (une entrée = une ligne, commentaire en fin de ligne).
//   - Pépites : zones écrites en clair dans pepites.ts, à l'intérieur de
//     l'objet du template.
//
// Ces fonctions sont pures (source texte -> source texte) pour être testables
// sans navigateur ni serveur : elles réécrivent un fichier de données, une
// erreur de découpage y serait silencieuse et destructrice.
import type { TemplateBox } from '../src/types.ts';

export function formatBox(b: TemplateBox): string {
  return `{ xPct: ${b.xPct}, yPct: ${b.yPct}, widthPct: ${b.widthPct}, heightPct: ${b.heightPct} }`;
}

// Échappe un id pour l'insérer dans une regex (les ids sont alphanumériques
// aujourd'hui, mais on ne veut pas que ça devienne une faille silencieuse).
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  const lines = source.split('\n');

  const entryRe = new RegExp(`^  '${escapeRe(imgflipId)}': \\[.*\\],(\\s*//.*)?$`);
  const existing = lines.findIndex((l) => entryRe.test(l));

  if (existing !== -1) {
    const comment = lines[existing].match(entryRe)![1] ?? '';
    lines[existing] = `  '${imgflipId}': ${inline},${comment}`;
    return lines.join('\n');
  }

  // Nouvelle entrée : insertion juste avant la fermeture de l'objet CURATED.
  const openIdx = lines.findIndex((l) => l.startsWith('const CURATED'));
  if (openIdx === -1) throw new Error('CURATED introuvable dans templateBoxes.ts');
  const closeIdx = lines.findIndex((l, i) => i > openIdx && l === '};');
  if (closeIdx === -1) throw new Error('Fin de CURATED introuvable dans templateBoxes.ts');

  lines.splice(closeIdx, 0, `  '${imgflipId}': ${inline}, // ${templateName}`);
  return lines.join('\n');
}

/**
 * Met à jour les zones d'un template du pack Pépites dans pepites.ts.
 * Reproduit la convention du fichier : une seule zone tient sur une ligne,
 * deux zones ou plus sont réparties une par ligne.
 */
export function writePepitesBoxes(source: string, templateId: string, boxes: TemplateBox[]): string {
  const lines = source.split('\n');

  const idIdx = lines.findIndex((l) => l.trim() === `id: '${templateId}',`);
  if (idIdx === -1) throw new Error(`Template ${templateId} introuvable dans pepites.ts`);

  const startIdx = lines.findIndex((l, i) => i > idIdx && l.trimStart().startsWith('boxes: ['));
  if (startIdx === -1) throw new Error(`Zones de ${templateId} introuvables dans pepites.ts`);

  // Une entrée sur une seule ligne se termine par "],", sinon on avance
  // jusqu'à la ligne de fermeture du tableau.
  let endIdx = startIdx;
  if (!lines[startIdx].trimEnd().endsWith('],')) {
    endIdx = lines.findIndex((l, i) => i > startIdx && l.trim() === '],');
    if (endIdx === -1) throw new Error(`Fin des zones de ${templateId} introuvable dans pepites.ts`);
  }

  const replacement =
    boxes.length === 1
      ? [`    boxes: [${formatBox(boxes[0])}],`]
      : ['    boxes: [', ...boxes.map((b) => `      ${formatBox(b)},`), '    ],'];

  lines.splice(startIdx, endIdx - startIdx + 1, ...replacement);
  return lines.join('\n');
}
