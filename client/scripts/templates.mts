// Outillage des packs de templates intégrés.
//
//   npm run templates:fingerprint          (re)calcule les empreintes des packs
//   npm run templates:import candidats.json   filtre des candidats à l'import
//   npm run templates:localize             télécharge les images vers public/templates/
//
// Le but : qu'aucun template déjà présent dans un pack ne soit importé une
// seconde fois. Les métadonnées ne suffisent pas (un même meme peut être servi
// sous deux ids/URLs/noms différents), donc on compare l'image elle-même :
// sha256 des octets pour les fichiers identiques, dhash perceptuel pour les
// ré-encodages et redimensionnements.
//
// Ces trois commandes ont besoin du réseau (accès à imgflip). Le test, lui, ne
// relit que les empreintes figées dans fingerprints.generated.ts et les images
// déjà locales dans public/templates/ : il reste hors-ligne.
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Jimp } from 'jimp';
import { TEMPLATE_PACKS, getPackTemplates } from '../src/lib/packs/index.ts';
import { findDuplicate, dhashDistance } from '../src/lib/packs/fingerprints.ts';
import type { Template } from '../src/types.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_FILE = path.join(HERE, '..', 'src', 'lib', 'packs', 'fingerprints.generated.ts');
const CLASSIQUES_FILE = path.join(HERE, '..', 'src', 'lib', 'packs', 'classiques.ts');
const PEPITES_FILE = path.join(HERE, '..', 'src', 'lib', 'packs', 'pepites.ts');
const TEMPLATES_DIR = path.join(HERE, '..', 'public', 'templates');
const DHASH_SIZE = 16; // 16x16 => 256 bits
const DOWNLOAD_CONCURRENCY = 8;

interface Fingerprint {
  sha256: string;
  dhash: string;
  width: number;
  height: number;
}

// Une fois localisé (npm run templates:localize), template.url n'est plus une
// URL réseau mais un chemin public Vite ("/templates/xxx.jpg") : on le relit
// directement sur disque plutôt que d'essayer un fetch réseau qui échouerait.
async function download(url: string): Promise<Buffer> {
  if (url.startsWith('/')) {
    return readFile(path.join(HERE, '..', 'public', url));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// dhash : on compare chaque pixel à son voisin de droite sur une vignette en
// niveaux de gris. Insensible à la luminosité globale et à la compression,
// contrairement à un hash cryptographique.
async function fingerprintBuffer(buf: Buffer): Promise<Fingerprint> {
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

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = next;
        next += 1;
        if (i >= items.length) return;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

function allPackTemplates(): { packId: string; template: Template }[] {
  return TEMPLATE_PACKS.flatMap((pack) =>
    getPackTemplates([pack.id]).map((template) => ({ packId: pack.id, template }))
  );
}

// ---------- commande : fingerprint ----------

async function cmdFingerprint(): Promise<number> {
  const entries = allPackTemplates();
  console.log(`Téléchargement de ${entries.length} images...`);

  const fingerprints = await mapLimit(entries, DOWNLOAD_CONCURRENCY, async ({ template }) => {
    const buf = await download(template.url);
    return fingerprintBuffer(buf);
  });

  const byId: Record<string, Fingerprint> = {};
  entries.forEach(({ template }, i) => {
    byId[template.id] = fingerprints[i];
  });

  // Contrôle immédiat : deux templates des packs ne doivent pas désigner la
  // même image. On le signale ici plutôt que d'écrire un fichier fautif.
  const collisions: string[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i];
      const b = entries[j];
      const fa = fingerprints[i];
      const fb = fingerprints[j];
      if (fa.sha256 === fb.sha256) {
        collisions.push(`  [${a.packId}] "${a.template.name}"  ==  [${b.packId}] "${b.template.name}"  (fichier identique)`);
        continue;
      }
      const distance = dhashDistance(fa.dhash, fb.dhash);
      if (distance <= 16) {
        collisions.push(`  [${a.packId}] "${a.template.name}"  ~~  [${b.packId}] "${b.template.name}"  (dhash ${distance})`);
      }
    }
  }

  const header = [
    '// FICHIER GÉNÉRÉ — ne pas éditer à la main.',
    '// Régénérer avec : npm run templates:fingerprint --workspace client',
    '//',
    "// Empreinte de l'image de chaque template intégré, pour que le test puisse",
    '// détecter hors-ligne deux entrées qui désignent le même meme. Voir',
    '// fingerprints.ts pour la comparaison.',
    '',
    'export interface TemplateFingerprint {',
    '  sha256: string;',
    '  dhash: string;',
    '  width: number;',
    '  height: number;',
    '}',
    '',
    'export const TEMPLATE_FINGERPRINTS: Record<string, TemplateFingerprint> = {',
  ].join('\n');

  const body = entries
    .map(({ template }) => {
      const f = byId[template.id];
      return `  '${template.id}': { sha256: '${f.sha256}', dhash: '${f.dhash}', width: ${f.width}, height: ${f.height} },`;
    })
    .join('\n');

  await writeFile(GENERATED_FILE, `${header}\n${body}\n};\n`, 'utf8');
  console.log(`✅ ${entries.length} empreintes écrites dans ${path.relative(process.cwd(), GENERATED_FILE)}`);

  if (collisions.length) {
    console.error(`\n❌ ${collisions.length} doublon(s) DANS les packs actuels :`);
    collisions.forEach((c) => console.error(c));
    console.error('\nRetire l\'entrée en trop, puis relance la commande.');
    return 1;
  }
  console.log('Aucun doublon dans les packs actuels.');
  return 0;
}

// ---------- commande : import ----------

interface Candidate {
  name: string;
  url: string;
}

async function cmdImport(file: string): Promise<number> {
  const raw = await readFile(file, 'utf8');
  const candidates: Candidate[] = JSON.parse(raw);
  if (!Array.isArray(candidates) || candidates.some((c) => !c?.name || !c?.url)) {
    console.error('Le fichier doit contenir un tableau JSON d\'objets { "name": "...", "url": "..." }.');
    return 1;
  }

  const existing = allPackTemplates();
  const knownUrls = new Map(existing.map((e) => [e.template.url, e.template.name]));
  const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const knownNames = new Map(existing.map((e) => [normName(e.template.name), e.template.name]));
  const nameById = new Map(existing.map((e) => [e.template.id, `[${e.packId}] ${e.template.name}`]));

  const { TEMPLATE_FINGERPRINTS } = await import('../src/lib/packs/fingerprints.generated.ts');

  console.log(`${candidates.length} candidat(s) à examiner contre ${existing.length} templates déjà intégrés.\n`);

  const results = await mapLimit(candidates, DOWNLOAD_CONCURRENCY, async (candidate) => {
    try {
      const buf = await download(candidate.url);
      return { candidate, fingerprint: await fingerprintBuffer(buf), error: null as string | null };
    } catch (e) {
      return { candidate, fingerprint: null, error: (e as Error).message };
    }
  });

  const accepted: { candidate: Candidate; fingerprint: Fingerprint }[] = [];
  const rejected: string[] = [];
  // Les candidats acceptés alimentent la comparaison au fur et à mesure, pour
  // écarter aussi les doublons présents à l'intérieur du lot lui-même.
  const pool: Record<string, { sha256: string; dhash: string }> = { ...TEMPLATE_FINGERPRINTS };

  for (const { candidate, fingerprint, error } of results) {
    const label = `"${candidate.name}"`;
    if (error || !fingerprint) {
      rejected.push(`  ⚠️  ${label} — image illisible : ${error}`);
      continue;
    }
    if (knownUrls.has(candidate.url)) {
      rejected.push(`  ⛔ ${label} — même URL que "${knownUrls.get(candidate.url)}"`);
      continue;
    }
    if (knownNames.has(normName(candidate.name))) {
      rejected.push(`  ⛔ ${label} — même nom que "${knownNames.get(normName(candidate.name))}"`);
      continue;
    }
    const hit = findDuplicate(fingerprint, pool);
    if (hit) {
      const against = nameById.get(hit.againstId) ?? hit.againstId;
      const how = hit.reason === 'sha256' ? 'fichier identique' : `même visuel (dhash ${hit.distance})`;
      rejected.push(`  ⛔ ${label} — ${how} que ${against}`);
      continue;
    }
    pool[`candidat:${candidate.name}`] = fingerprint;
    nameById.set(`candidat:${candidate.name}`, `(ce lot) ${candidate.name}`);
    accepted.push({ candidate, fingerprint });
  }

  if (rejected.length) {
    console.log(`Écartés (${rejected.length}) :`);
    rejected.forEach((r) => console.log(r));
    console.log('');
  }

  if (!accepted.length) {
    console.log('Aucun nouveau template à ajouter.');
    return 0;
  }

  console.log(`Nouveaux (${accepted.length}) — entrées prêtes à coller dans un fichier de pack :\n`);
  for (const { candidate, fingerprint } of accepted) {
    const slug = normName(candidate.name).replace(/ /g, '-');
    console.log(`  {
    id: 'pepites-${slug}',
    url: '${candidate.url}',
    name: ${JSON.stringify(candidate.name)},
    source: 'library',
    // ${fingerprint.width}x${fingerprint.height} — à caler en vérifiant le rendu réel
    boxes: [{ xPct: 50, yPct: 10, widthPct: 88, heightPct: 16 }],
  },`);
  }
  console.log('\nAprès ajout, relance : npm run templates:fingerprint --workspace client');
  return 0;
}

// ---------- commande : localize ----------

// Échappe un id pour l'insérer dans une regex (même logique que boxWriter.mts).
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Découpe en lignes sans `\r` de fin, EOL détecté réutilisé à l'écriture —
// même précaution que boxWriter.mts pour ne pas casser un checkout Windows.
function splitLines(source: string): { lines: string[]; eol: '\n' | '\r\n' } {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  return { lines: source.split(/\r?\n/), eol };
}

// Réécrit l'url d'une entrée de pack, que le fichier l'écrive sur la même
// ligne que l'id (classiques.ts) ou sur la ligne suivante (pepites.ts).
// Échoue bruyamment plutôt que de rester silencieuse sur une entrée non
// trouvée : mieux vaut planter que laisser une url distante orpheline.
function rewriteUrl(source: string, id: string, newUrl: string): string {
  const { lines, eol } = splitLines(source);
  const idRe = new RegExp(`id: '${escapeRe(id)}'`);
  const urlRe = /url: '[^']*'/;

  for (let i = 0; i < lines.length; i += 1) {
    if (!idRe.test(lines[i])) continue;
    if (urlRe.test(lines[i])) {
      lines[i] = lines[i].replace(urlRe, `url: '${newUrl}'`);
      return lines.join(eol);
    }
    if (lines[i + 1] && urlRe.test(lines[i + 1])) {
      lines[i + 1] = lines[i + 1].replace(urlRe, `url: '${newUrl}'`);
      return lines.join(eol);
    }
  }
  throw new Error(`Entrée id='${id}' introuvable (ou sans url à côté) pour réécriture.`);
}

function extOf(url: string): string {
  const match = /\.([a-zA-Z0-9]+)(?:\?.*)?$/.exec(url);
  return match ? match[1].toLowerCase() : 'jpg';
}

// Télécharge toutes les images encore distantes (url http...) vers
// public/templates/ et réécrit classiques.ts/pepites.ts pour pointer vers
// ces fichiers locaux. Idempotente : une fois une entrée localisée, son url
// commence par "/" et download() la relit sur disque au lieu de refaire une
// requête réseau, donc relancer la commande ne télécharge que ce qu'il reste.
async function cmdLocalize(): Promise<number> {
  const entries = allPackTemplates().filter(({ template }) => template.url.startsWith('http'));
  if (!entries.length) {
    console.log('Toutes les images sont déjà locales (aucune url http à télécharger).');
    return 0;
  }

  console.log(`Téléchargement de ${entries.length} image(s) vers ${path.relative(process.cwd(), TEMPLATES_DIR)}...`);
  await mkdir(TEMPLATES_DIR, { recursive: true });

  const failures: string[] = [];
  const localized: { packId: string; rawId: string; newUrl: string }[] = [];

  await mapLimit(entries, DOWNLOAD_CONCURRENCY, async ({ packId, template }) => {
    try {
      const buf = await download(template.url);
      const fileName = `${template.id}.${extOf(template.url)}`;
      await writeFile(path.join(TEMPLATES_DIR, fileName), buf);
      // classiques.ts référence l'id nu ('222403160'), sans le préfixe
      // "imgflip-" que porte Template.id — pepites.ts utilise déjà l'id complet.
      const rawId = packId === 'classiques' ? template.id.replace(/^imgflip-/, '') : template.id;
      localized.push({ packId, rawId, newUrl: `/templates/${fileName}` });
    } catch (e) {
      failures.push(`  ⚠️  [${packId}] "${template.name}" (${template.id}) — ${(e as Error).message}`);
    }
  });

  if (!localized.length) {
    console.error('\n❌ Aucun téléchargement n\'a réussi.');
    failures.forEach((f) => console.error(f));
    return 1;
  }

  let classiquesSource = await readFile(CLASSIQUES_FILE, 'utf8');
  let pepitesSource = await readFile(PEPITES_FILE, 'utf8');

  for (const { packId, rawId, newUrl } of localized) {
    if (packId === 'classiques') {
      classiquesSource = rewriteUrl(classiquesSource, rawId, newUrl);
    } else {
      pepitesSource = rewriteUrl(pepitesSource, rawId, newUrl);
    }
  }

  await writeFile(CLASSIQUES_FILE, classiquesSource, 'utf8');
  await writeFile(PEPITES_FILE, pepitesSource, 'utf8');

  console.log(`✅ ${localized.length} image(s) téléchargée(s) et url(s) réécrites en chemins locaux.`);
  if (failures.length) {
    console.error(`\n⚠️  ${failures.length} échec(s) (url encore distante, relance la commande pour réessayer) :`);
    failures.forEach((f) => console.error(f));
    return 1;
  }
  console.log(
    "\nN'oublie pas : npm run templates:fingerprint --workspace client (les empreintes changent si l'image a été ré-encodée en transit), puis commit + push des images et du code."
  );
  return 0;
}

// ---------- entrée ----------

const [command, ...args] = process.argv.slice(2);
let code = 0;
if (command === 'fingerprint') {
  code = await cmdFingerprint();
} else if (command === 'import') {
  if (!args[0]) {
    console.error('Usage : npm run templates:import --workspace client -- <candidats.json>');
    code = 1;
  } else {
    code = await cmdImport(args[0]);
  }
} else if (command === 'localize') {
  code = await cmdLocalize();
} else {
  console.error('Commandes : fingerprint | import <candidats.json> | localize');
  code = 1;
}
process.exit(code);
