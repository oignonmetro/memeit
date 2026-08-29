// Vérifie la réécriture des zones de texte dans les fichiers de données, et
// que l'éditeur reste hors du bundle de production.
//
// Ces fonctions réécrivent des fichiers source versionnés : une erreur de
// découpage y serait silencieuse et destructrice, d'où le test d'identité
// (réécrire les valeurs actuelles ne doit rien changer, sur les 112 entrées).
import assert from 'node:assert';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { writeCuratedBoxes, writePepitesBoxes, formatBox } from './boxWriter.mts';
import { CLASSIQUES_TEMPLATES } from '../src/lib/packs/classiques.ts';
import { PEPITES_TEMPLATES } from '../src/lib/packs/pepites.ts';
import type { TemplateBox } from '../src/types.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.join(HERE, '..');
const TEMPLATE_BOXES = path.join(CLIENT, 'src', 'lib', 'templateBoxes.ts');
const PEPITES = path.join(CLIENT, 'src', 'lib', 'packs', 'pepites.ts');

const tbSrc = readFileSync(TEMPLATE_BOXES, 'utf8');
const ppSrc = readFileSync(PEPITES, 'utf8');
const rawId = (id: string) => id.replace(/^imgflip-/, '');

console.log('--- réécriture des zones : identité ---');

// 1. Pépites : réécrire chaque template avec ses valeurs actuelles doit
//    laisser le fichier octet pour octet identique.
let out = ppSrc;
for (const t of PEPITES_TEMPLATES) out = writePepitesBoxes(out, t.id, t.boxes);
assert.equal(out, ppSrc, 'la réécriture de pepites.ts a modifié le fichier');
console.log(`PASS  pépites    → ${PEPITES_TEMPLATES.length} entrées réécrites à l'identique`);

// 2. Idem pour les entrées déjà curées de templateBoxes.ts.
const curatedIds = new Set([...tbSrc.matchAll(/^ {2}'(\d+)':/gm)].map((m) => m[1]));
let out2 = tbSrc;
let curatedCount = 0;
for (const t of CLASSIQUES_TEMPLATES) {
  if (!curatedIds.has(rawId(t.id))) continue;
  out2 = writeCuratedBoxes(out2, rawId(t.id), t.boxes, t.name);
  curatedCount += 1;
}
assert.equal(out2, tbSrc, 'la réécriture de templateBoxes.ts a modifié le fichier');
console.log(`PASS  classiques → ${curatedCount} entrées curées réécrites à l'identique`);

console.log('--- réécriture des zones : modification ---');

// 3. Modifier une entrée existante ne touche que sa ligne, et conserve le
//    commentaire de fin de ligne (qui documente le choix de placement).
const moved: TemplateBox[] = [{ xPct: 11, yPct: 22, widthPct: 33, heightPct: 44 }];
const edited = writeCuratedBoxes(tbSrc, '438680', moved, 'Batman Slapping Robin');
const beforeLines = tbSrc.split('\n');
const afterLines = edited.split('\n');
assert.equal(beforeLines.length, afterLines.length, 'le nombre de lignes a changé');
const changed = afterLines.filter((l, i) => l !== beforeLines[i]);
assert.equal(changed.length, 1, `${changed.length} lignes modifiées au lieu d'une seule`);
assert.ok(changed[0].includes('xPct: 11'), 'les nouvelles coordonnées sont absentes');
assert.ok(changed[0].includes('// Batman Slapping Robin'), 'le commentaire a été perdu');
console.log('PASS  édition    → une seule ligne touchée, commentaire conservé');

// 4. Un template encore générique reçoit une nouvelle entrée dans CURATED.
const newId = '999000111';
assert.ok(!curatedIds.has(newId), 'id de test déjà présent');
const added = writeCuratedBoxes(tbSrc, newId, moved, 'Template De Test');
assert.equal(added.split('\n').length, beforeLines.length + 1, 'une seule ligne aurait dû être ajoutée');
assert.ok(added.includes(`  '${newId}': [{ xPct: 11`), 'entrée absente');
assert.ok(added.includes('// Template De Test'), 'nom absent du commentaire');
assert.ok(added.indexOf(`'${newId}'`) < added.indexOf('export function boxesForImgflip'), 'entrée insérée hors de CURATED');
console.log('PASS  ajout      → nouvelle entrée insérée dans CURATED');

// 5. Pépites : la convention du fichier est respectée — une zone tient sur une
//    ligne, deux zones ou plus sont réparties une par ligne.
const one = writePepitesBoxes(ppSrc, 'pepites-stonks', moved);
assert.ok(one.includes(`    boxes: [{ xPct: 11, yPct: 22, widthPct: 33, heightPct: 44 }],`), 'zone unique non inline');
const two = writePepitesBoxes(ppSrc, 'pepites-stonks', [...moved, { xPct: 50, yPct: 60, widthPct: 70, heightPct: 80 }]);
assert.ok(two.includes('    boxes: [\n      { xPct: 11'), 'deux zones non réparties sur plusieurs lignes');
console.log('PASS  format     → 1 zone inline, 2+ zones une par ligne');

// 6. Un id inconnu échoue bruyamment plutôt que de corrompre le fichier.
assert.throws(() => writePepitesBoxes(ppSrc, 'pepites-inexistant', moved), /introuvable/);
console.log('PASS  garde-fou  → un id inconnu lève une erreur');

// 7. rotationDeg est omis quand il vaut 0 (défaut de l'écrasante majorité des
// zones) et n'apparaît que sur celles qu'un éditeur a effectivement pivotées
// — sinon éditer une zone sur un template en aurait reformaté 148 autres.
assert.equal(formatBox({ xPct: 1, yPct: 2, widthPct: 3, heightPct: 4 }), '{ xPct: 1, yPct: 2, widthPct: 3, heightPct: 4 }');
assert.equal(formatBox({ xPct: 1, yPct: 2, widthPct: 3, heightPct: 4, rotationDeg: 0 }), '{ xPct: 1, yPct: 2, widthPct: 3, heightPct: 4 }');
assert.equal(
  formatBox({ xPct: 1, yPct: 2, widthPct: 3, heightPct: 4, rotationDeg: 30 }),
  '{ xPct: 1, yPct: 2, widthPct: 3, heightPct: 4, rotationDeg: 30 }'
);
console.log('PASS  rotation   → rotationDeg omis à 0, présent sinon');

console.log('--- fins de ligne Windows (CRLF) ---');

// 7. Un checkout Windows (core.autocrlf) donne des fichiers en \r\n. Un split
//    naïf sur '\n' laisse un '\r' traînant en fin de ligne, qui casse la
//    comparaison stricte `l === '};'` (repéré en usage réel : "Fin de CURATED
//    introuvable") — et, plus sournois, aurait aussi cassé le `$` de fin de
//    l'entryRe pour la mise à jour d'une entrée existante, sans lever la
//    moindre erreur : chaque édition aurait silencieusement dupliqué
//    l'entrée en fin de fichier plutôt que de mettre à jour la bonne ligne.
const tbCRLF = tbSrc.replace(/\n/g, '\r\n');
const ppCRLF = ppSrc.replace(/\n/g, '\r\n');

let outCRLF = ppCRLF;
for (const t of PEPITES_TEMPLATES) outCRLF = writePepitesBoxes(outCRLF, t.id, t.boxes);
assert.equal(outCRLF, ppCRLF, 'round-trip CRLF de pepites.ts a modifié le fichier');

let outCRLF2 = tbCRLF;
for (const t of CLASSIQUES_TEMPLATES) {
  if (!curatedIds.has(rawId(t.id))) continue;
  outCRLF2 = writeCuratedBoxes(outCRLF2, rawId(t.id), t.boxes, t.name);
}
assert.equal(outCRLF2, tbCRLF, 'round-trip CRLF de templateBoxes.ts a modifié le fichier');
console.log('PASS  CRLF round-trip → 112 entrées réécrites à l\'identique sur fichier \\r\\n');

// Une entrée existante mise à jour sur un fichier CRLF doit toucher une seule
// ligne (pas de duplication) et garder du CRLF partout, pas un mélange.
const editedCRLF = writeCuratedBoxes(tbCRLF, '438680', moved, 'Batman Slapping Robin');
const linesBeforeCRLF = tbCRLF.split('\r\n');
const linesAfterCRLF = editedCRLF.split('\r\n');
assert.equal(linesBeforeCRLF.length, linesAfterCRLF.length, 'CRLF : le nombre de lignes a changé (duplication ?)');
assert.equal(
  linesAfterCRLF.filter((l, i) => l !== linesBeforeCRLF[i]).length,
  1,
  'CRLF : plus d\'une ligne modifiée'
);
assert.ok(!editedCRLF.split('\r\n').some((l) => l.endsWith('\r')), 'CRLF : du CRLF résiduel après découpage');
assert.ok(editedCRLF.includes('\r\n') && !/[^\r]\n/.test(editedCRLF), 'CRLF : mélange de fins de ligne introduit');
console.log('PASS  CRLF édition → une seule ligne touchée, aucun mélange de fins de ligne');

// Une nouvelle entrée sur un fichier CRLF doit réussir (c'était l'échec
// remonté : "Fin de CURATED introuvable dans templateBoxes.ts").
const addedCRLF = writeCuratedBoxes(tbCRLF, '999000111', moved, 'Template De Test');
assert.ok(addedCRLF.includes(`'999000111': [{ xPct: 11`), 'CRLF : nouvelle entrée absente');
console.log('PASS  CRLF ajout   → nouvelle entrée insérée sans erreur');

console.log("--- l'éditeur reste hors production ---");

// 7. L'éditeur est un outil de dev : il ne doit jamais atteindre dist/. La
//    garantie est structurelle (le build ne prend que index.html en entrée),
//    ce test la verrouille contre une régression.
const dist = path.join(CLIENT, 'dist');
const assets = path.join(dist, 'assets');
if (existsSync(assets)) {
  const bundled = readdirSync(assets)
    .map((f) => readFileSync(path.join(assets, f), 'utf8'))
    .join('\n');
  assert.ok(!bundled.includes('__boxes/save'), "l'éditeur de zones est présent dans dist/");
  assert.ok(!bundled.includes('be-overlay'), "les styles de l'éditeur sont présents dans dist/");
  assert.ok(!existsSync(path.join(dist, 'dev-boxes.html')), 'dev-boxes.html a été copié dans dist/');
  console.log("PASS  bundle     → aucune trace de l'éditeur dans dist/");
} else {
  console.log('SKIP  bundle     → dist/ absent (lancer npm run build pour vérifier)');
}

console.log('\nRESULT: PASS — réécriture sûre des zones de texte.');
