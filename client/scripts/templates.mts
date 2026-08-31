// Outillage des packs de templates intégrés.
//
//   npm run templates:fingerprint          (re)calcule les empreintes des packs
//   npm run templates:import candidats.json   filtre des candidats à l'import
//   npm run templates:localize             télécharge les images vers public/templates/
//   npm run templates:snap                 intègre les images déposées dans templates-snap/
//   npm run templates:tiktok               intègre les images déposées dans templates-tiktok/
//
// snap et tiktok sont deux instances de la même commande générique (voir
// DROP_PACKS plus bas) : des packs "faits main", sans catalogue en ligne à
// interroger, dont les images sont déposées par un humain dans un dossier
// dédié. En ajouter un nouveau n'a rien d'un copier-coller de tout ce
// fichier — une entrée dans DROP_PACKS suffit.
//
// Le but : qu'aucun template déjà présent dans un pack ne soit importé une
// seconde fois. Les métadonnées ne suffisent pas (un même meme peut être servi
// sous deux ids/URLs/noms différents), donc on compare l'image elle-même :
// sha256 des octets pour les fichiers identiques, dhash perceptuel pour les
// ré-encodages et redimensionnements.
//
// import et localize ont besoin du réseau (accès à imgflip) ; fingerprint n'en
// a plus besoin depuis que les images sont locales, et les packs "faits main"
// n'en ont jamais eu besoin (ils lisent des fichiers déposés à la main). Le
// test, lui, ne relit que les empreintes figées dans fingerprints.generated.ts
// et les images déjà locales dans public/templates/ : il reste hors-ligne.
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Jimp } from 'jimp';
import { TEMPLATE_PACKS, getPackTemplates } from '../src/lib/packs/index.ts';
import { findDuplicate, dhashDistance } from '../src/lib/packs/fingerprints.ts';
import { formatBox } from './boxWriter.mts';
import type { Template } from '../src/types.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_FILE = path.join(HERE, '..', 'src', 'lib', 'packs', 'fingerprints.generated.ts');
const CLASSIQUES_FILE = path.join(HERE, '..', 'src', 'lib', 'packs', 'classiques.ts');
const PEPITES_FILE = path.join(HERE, '..', 'src', 'lib', 'packs', 'pepites.ts');
const TEMPLATES_DIR = path.join(HERE, '..', 'public', 'templates');

interface DropPackConfig {
  id: string; // préfixe d'id ('snap-...', 'tiktok-...') et nom de commande npm
  packName: string; // nom affiché (messages, commentaires du fichier généré)
  exportName: string; // nom de la constante exportée, ex. 'SNAP_TEMPLATES'
  file: string; // chemin vers src/lib/packs/<id>.ts
  dropDir: string; // chemin vers templates-<id>/, où les images sont déposées
}

// Packs "faits main" : leurs images ne viennent d'aucun catalogue en ligne
// (contrairement à classiques.ts/pepites.ts, sourcés depuis Imgflip), donc
// pas d'URL à télécharger — elles sont déposées à la main dans
// templates-<id>/, puis intégrées par `npm run templates:<id>`.
//
// Ajouter un pack : une entrée ici, un fichier vide src/lib/packs/<id>.ts
// (`export const <EXPORT_NAME>: Template[] = [];`), un dossier
// templates-<id>/ (copier templates-snap/LISEZ-MOI.md comme modèle), une
// ligne dans package.json, et l'enregistrement conditionnel dans
// packs/index.ts (voir comment SNAP_TEMPLATES y est déjà branché).
const DROP_PACKS: Record<string, DropPackConfig> = {
  snap: {
    id: 'snap',
    packName: 'Snap français',
    exportName: 'SNAP_TEMPLATES',
    file: path.join(HERE, '..', 'src', 'lib', 'packs', 'snap.ts'),
    dropDir: path.join(HERE, '..', 'templates-snap'),
  },
  tiktok: {
    id: 'tiktok',
    packName: 'TikTok France',
    exportName: 'TIKTOK_TEMPLATES',
    file: path.join(HERE, '..', 'src', 'lib', 'packs', 'tiktok.ts'),
    dropDir: path.join(HERE, '..', 'templates-tiktok'),
  },
};
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

// Dans quel fichier source une entrée est-elle écrite ? Le pack ne le dit
// plus depuis la fusion ("classiques" couvre classiques.ts ET pepites.ts) :
// c'est le préfixe de l'id qui identifie le fichier de façon fiable, et qui
// dit aussi sous quelle forme l'id y est écrit (classiques.ts référence l'id
// nu, sans le préfixe "imgflip-" que porte Template.id).
function sourceFileFor(templateId: string): { file: string; rawId: string } {
  if (templateId.startsWith('imgflip-')) {
    return { file: CLASSIQUES_FILE, rawId: templateId.replace(/^imgflip-/, '') };
  }
  for (const pack of Object.values(DROP_PACKS)) {
    if (templateId.startsWith(`${pack.id}-`)) return { file: pack.file, rawId: templateId };
  }
  return { file: PEPITES_FILE, rawId: templateId };
}

// Télécharge toutes les images encore distantes (url http...) vers
// public/templates/ et réécrit le fichier de pack correspondant pour pointer
// vers ces fichiers locaux. Idempotente : une fois une entrée localisée, son
// url commence par "/" et download() la relit sur disque au lieu de refaire
// une requête réseau, donc relancer ne télécharge que ce qu'il reste.
async function cmdLocalize(): Promise<number> {
  const entries = allPackTemplates().filter(({ template }) => template.url.startsWith('http'));
  if (!entries.length) {
    console.log('Toutes les images sont déjà locales (aucune url http à télécharger).');
    return 0;
  }

  console.log(`Téléchargement de ${entries.length} image(s) vers ${path.relative(process.cwd(), TEMPLATES_DIR)}...`);
  await mkdir(TEMPLATES_DIR, { recursive: true });

  const failures: string[] = [];
  const localized: { templateId: string; newUrl: string }[] = [];

  await mapLimit(entries, DOWNLOAD_CONCURRENCY, async ({ packId, template }) => {
    try {
      const buf = await download(template.url);
      const fileName = `${template.id}.${extOf(template.url)}`;
      await writeFile(path.join(TEMPLATES_DIR, fileName), buf);
      localized.push({ templateId: template.id, newUrl: `/templates/${fileName}` });
    } catch (e) {
      failures.push(`  ⚠️  [${packId}] "${template.name}" (${template.id}) — ${(e as Error).message}`);
    }
  });

  if (!localized.length) {
    console.error('\n❌ Aucun téléchargement n\'a réussi.');
    failures.forEach((f) => console.error(f));
    return 1;
  }

  // Chaque fichier n'est lu qu'une fois puis réécrit une fois, avec toutes
  // ses entrées mises à jour d'affilée.
  const sources = new Map<string, string>();
  for (const { templateId, newUrl } of localized) {
    const { file, rawId } = sourceFileFor(templateId);
    if (!sources.has(file)) sources.set(file, await readFile(file, 'utf8'));
    sources.set(file, rewriteUrl(sources.get(file)!, rawId, newUrl));
  }
  for (const [file, content] of sources) await writeFile(file, content, 'utf8');

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

// ---------- commande : import-drop (packs "faits main", ex. snap, tiktok) ----------

// Jimp ne décode ni le webp ni l'avif : une image dans un de ces formats
// passerait l'import pour faire échouer templates:fingerprint plus tard, avec
// un message sans rapport avec le fichier fautif. On les refuse ici, là où on
// peut encore nommer le fichier à convertir.
const DROP_EXTS = new Set(['.jpg', '.jpeg', '.png']);
const DROP_REJECTED_EXTS = new Set(['.webp', '.avif', '.gif', '.heic', '.bmp', '.tiff']);

const rel = (p: string) => path.relative(process.cwd(), p);
const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // accents : "café" -> "cafe"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// "chat_qui_dort.jpg" -> "Chat qui dort" : le nom de fichier est ce que
// l'utilisateur a sous les yeux, c'est le libellé le moins surprenant.
function prettyName(fileBase: string): string {
  const cleaned = fileBase.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned;
}

function quote(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function dropPackHeader(pack: DropPackConfig): string {
  return `import type { Template } from '../../types';

// FICHIER GÉNÉRÉ — régénéré par : npm run templates:${pack.id} --workspace client
//
// Pack "${pack.packName}" : des memes qui ne viennent d'aucun catalogue en
// ligne, donc rien à télécharger automatiquement. Les images sont déposées à
// la main dans client/templates-${pack.id}/, et la commande ci-dessus les
// range dans public/templates/ puis met ce fichier à jour.
//
// La commande est ADDITIVE : elle ajoute les nouvelles images sans jamais
// toucher aux entrées déjà là (leurs zones, réglées dans l'éditeur visuel,
// survivent donc à un ré-import). Pour retirer un template, passer par
// « Supprimer ce template » dans l'éditeur.
//
// Le format reproduit exactement celui de pepites.ts (zones écrites en clair
// dans l'entrée, une par ligne dès qu'il y en a deux) : c'est ce que sait
// relire et réécrire boxWriter.mts, donc l'éditeur visuel de zones édite ce
// pack comme les autres.
//
// Tant que ce tableau est vide, le pack n'est pas enregistré du tout dans
// packs/index.ts : il n'apparaît ni dans le lobby, ni dans les tests.
export const ${pack.exportName}: Template[] = [`;
}

function renderDropEntry(t: Template): string {
  const boxes =
    t.boxes.length === 1
      ? `    boxes: [${formatBox(t.boxes[0])}],`
      : ['    boxes: [', ...t.boxes.map((b) => `      ${formatBox(b)},`), '    ],'].join('\n');
  return [
    '  {',
    `    id: ${quote(t.id)},`,
    `    url: ${quote(t.url)},`,
    `    name: ${quote(t.name)},`,
    `    source: 'library',`,
    boxes,
    '  },',
  ].join('\n');
}

async function cmdImportDrop(packId: string): Promise<number> {
  const pack = DROP_PACKS[packId];
  if (!pack) {
    console.error(`Pack inconnu : ${packId}. Packs "faits main" déclarés : ${Object.keys(DROP_PACKS).join(', ')}.`);
    return 1;
  }

  const module = await import(`../src/lib/packs/${pack.id}.ts`);
  const existing: Template[] = [...(module[pack.exportName] as Template[])];

  let entries: string[];
  try {
    entries = await readdir(pack.dropDir);
  } catch {
    console.error(`❌ Dossier introuvable : ${rel(pack.dropDir)}`);
    console.error('   Crée-le et dépose les images dedans, puis relance.');
    return 1;
  }

  const files = entries.filter((f) => DROP_EXTS.has(path.extname(f).toLowerCase())).sort();
  const badFormat = entries.filter((f) => DROP_REJECTED_EXTS.has(path.extname(f).toLowerCase())).sort();

  if (!files.length && !badFormat.length) {
    console.log(`Aucune image dans ${rel(pack.dropDir)} (formats acceptés : .jpg, .jpeg, .png).`);
    return 0;
  }

  // Les empreintes figées couvrent tout ce qui est déjà commité ; on complète
  // au vol pour les templates ajoutés depuis (typiquement un import précédent
  // dont les empreintes n'ont pas encore été régénérées).
  const { TEMPLATE_FINGERPRINTS } = await import('../src/lib/packs/fingerprints.generated.ts');
  const pool: Record<string, { sha256: string; dhash: string }> = { ...TEMPLATE_FINGERPRINTS };

  // allPackTemplates() ne voit ce pack que s'il est déjà enregistré dans
  // packs/index.ts — pas garanti pour un tout nouveau pack encore vide au
  // moment de son premier import. On fusionne donc explicitement avec
  // `existing` (lu directement depuis le fichier du pack, indépendamment de
  // cet enregistrement) : sans ça, réimporter avant d'avoir branché le pack
  // dans packs/index.ts ne verrait pas ses propres entrées déjà là, et les
  // dupliquerait en silence au lieu de les reconnaître comme "déjà intégrées".
  const packEntries = allPackTemplates();
  const seenIds = new Set(packEntries.map((e) => e.template.id));
  const allKnown = [
    ...packEntries,
    ...existing.filter((t) => !seenIds.has(t.id)).map((template) => ({ packId: pack.id, template })),
  ];
  const label = new Map(allKnown.map((e) => [e.template.id, `[${e.packId}] ${e.template.name}`]));
  const knownNames = new Map(allKnown.map((e) => [normName(e.template.name), e.template.name]));
  const knownIds = new Set(allKnown.map((e) => e.template.id));

  const missing = allKnown.filter(({ template }) => !pool[template.id]);
  if (missing.length) {
    console.log(`Empreintes manquantes pour ${missing.length} template(s) déjà intégré(s), calcul...`);
    await mapLimit(missing, DOWNLOAD_CONCURRENCY, async ({ template }) => {
      try {
        pool[template.id] = await fingerprintBuffer(await download(template.url));
      } catch {
        // Image illisible : on ne peut pas comparer contre elle, tant pis —
        // mieux vaut continuer que bloquer tout l'import pour ça.
      }
    });
  }

  console.log(`${files.length} image(s) à examiner dans ${rel(pack.dropDir)}.\n`);
  await mkdir(TEMPLATES_DIR, { recursive: true });

  const added: Template[] = [];
  const skipped: string[] = [];
  const problems: string[] = [];

  for (const file of badFormat) {
    problems.push(`  ⛔ ${file} — format non géré : convertis-la en .jpg ou .png`);
  }

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const base = path.basename(file, path.extname(file));
    const slug = slugify(base);
    if (!slug) {
      problems.push(`  ⛔ ${file} — nom de fichier sans caractère exploitable, renomme-le`);
      continue;
    }
    const id = `${pack.id}-${slug}`;
    const name = prettyName(base);

    let fingerprint: Fingerprint;
    try {
      fingerprint = await fingerprintBuffer(await readFile(path.join(pack.dropDir, file)));
    } catch (e) {
      problems.push(`  ⛔ ${file} — image illisible : ${(e as Error).message}`);
      continue;
    }

    // Déjà importée : même id (ré-import du même fichier) ou même image sous
    // un autre nom de fichier. Dans les deux cas on passe, sans rien écraser.
    const hit = findDuplicate(fingerprint, pool);
    if (hit) {
      const against = label.get(hit.againstId) ?? hit.againstId;
      const how = hit.reason === 'sha256' ? 'image identique' : `même visuel (dhash ${hit.distance})`;
      skipped.push(`  ↩︎  ${file} — ${how} que ${against}`);
      continue;
    }
    if (knownIds.has(id)) {
      problems.push(`  ⛔ ${file} — l'id ${id} existe déjà pour une autre image, renomme le fichier`);
      continue;
    }
    if (knownNames.has(normName(name))) {
      problems.push(`  ⛔ ${file} — même nom que "${knownNames.get(normName(name))}", renomme le fichier`);
      continue;
    }

    const fileName = `${id}${ext === '.jpeg' ? '.jpg' : ext}`;
    await writeFile(
      path.join(TEMPLATES_DIR, fileName),
      await readFile(path.join(pack.dropDir, file))
    );

    const template: Template = {
      id,
      url: `/templates/${fileName}`,
      name,
      source: 'library',
      // Disposition générique haut/bas, à recaler dans l'éditeur visuel : sans
      // avoir vu l'image, toute autre position serait une devinette.
      boxes: [
        { xPct: 50, yPct: 15, widthPct: 90, heightPct: 26 },
        { xPct: 50, yPct: 85, widthPct: 90, heightPct: 26 },
      ],
    };
    added.push(template);
    pool[id] = fingerprint;
    label.set(id, `[${pack.id}] ${name}`);
    knownIds.add(id);
    knownNames.set(normName(name), name);
  }

  if (skipped.length) {
    console.log(`Déjà intégrées (${skipped.length}) :`);
    skipped.forEach((s) => console.log(s));
    console.log('');
  }
  if (problems.length) {
    console.error(`À corriger (${problems.length}) :`);
    problems.forEach((p) => console.error(p));
    console.error('');
  }

  if (!added.length) {
    console.log('Aucune nouvelle image intégrée.');
    return problems.length ? 1 : 0;
  }

  // Un fichier refusé ne fait pas échouer un import qui a par ailleurs
  // fonctionné : il est déjà listé juste au-dessus, en clair, et sortir en
  // erreur ferait afficher à npm un pavé rouge qui donne l'impression que
  // rien n'a marché. On ne sort en erreur que si RIEN n'a pu être intégré
  // (cas traité juste au-dessus).

  const all = [...existing, ...added];
  const body = all.map(renderDropEntry).join('\n');
  await writeFile(pack.file, `${dropPackHeader(pack)}\n${body}\n];\n`, 'utf8');

  console.log(`✅ ${added.length} image(s) ajoutée(s) au pack ${pack.packName} (${all.length} au total).`);
  added.forEach((t) => console.log(`  + ${t.name}`));
  console.log('\nÀ faire ensuite :');
  console.log('  1. npm run templates:fingerprint --workspace client   (empreintes des nouvelles images)');
  console.log('  2. npm run boxes:edit --workspace client              (recaler les zones de texte)');
  console.log('  3. commit + push');
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
} else if (command && DROP_PACKS[command]) {
  // Chaque pack "fait main" (snap, tiktok...) déclaré dans DROP_PACKS
  // devient automatiquement une commande, sans rien à ajouter ici.
  code = await cmdImportDrop(command);
} else {
  console.error(
    `Commandes : fingerprint | import <candidats.json> | localize | ${Object.keys(DROP_PACKS).join(' | ')}`
  );
  code = 1;
}
process.exit(code);
