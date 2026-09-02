// Plugin Vite qui donne à l'éditeur visuel de zones (/dev/boxes) le droit
// d'écrire dans les fichiers source du dépôt.
//
// `apply: 'serve'` : ce plugin n'existe que sous `vite dev`. Rien de tout ceci
// n'atteint le build de production, qui n'a de toute façon aucune raison de
// pouvoir réécrire des fichiers.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Plugin } from 'vite';
import {
  writeCuratedBoxes,
  writePepitesBoxes,
  deleteClassiqueEntry,
  deletePepitesEntry,
  deleteCuratedBoxes,
  deleteFingerprintEntry,
  upsertFingerprintEntry,
} from './boxWriter.mts';
import { fingerprintBuffer } from './imageFingerprint.mts';
import type { TemplateBox } from '../src/types.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.join(HERE, '..');
const TEMPLATE_BOXES = path.join(CLIENT, 'src', 'lib', 'templateBoxes.ts');
const CLASSIQUES = path.join(CLIENT, 'src', 'lib', 'packs', 'classiques.ts');
const PEPITES = path.join(CLIENT, 'src', 'lib', 'packs', 'pepites.ts');
const SNAP = path.join(CLIENT, 'src', 'lib', 'packs', 'snap.ts');
const FINGERPRINTS = path.join(CLIENT, 'src', 'lib', 'packs', 'fingerprints.generated.ts');
const TEMPLATES_DIR = path.join(CLIENT, 'public', 'templates');
const REVIEWED = path.join(HERE, 'boxes-reviewed.json');

type PackId = 'classiques' | 'pepites' | 'snap';

// pepites.ts et les packs "faits main" (snap.ts...) partagent exactement le
// même format (zones écrites en clair dans l'entrée, id complet, entrée
// multi-lignes) : seul le fichier change, donc les mêmes fonctions de
// réécriture servent à tous. classiques.ts est à part — ses zones vivent
// dans CURATED (templateBoxes.ts), sous l'id nu sans le préfixe "imgflip-".
const INLINE_PACK_FILES: Partial<Record<PackId, string>> = {
  pepites: PEPITES,
  snap: SNAP,
};

interface SavePayload {
  pack: PackId;
  id: string; // id du template dans le pack (imgflip-…, pepites-… ou snap-…)
  name: string;
  boxes: TemplateBox[];
}

interface DeletePayload {
  pack: PackId;
  id: string; // id complet du template (imgflip-…, pepites-… ou snap-…)
}

interface BakeTextPayload {
  id: string; // id complet du template (imgflip-…, pepites-… ou snap-…), pour l'empreinte
  url: string; // template.url, ex. "/templates/xxx.jpg" — désigne le fichier à écraser
  dataUrl: string; // image déjà composée côté client (template + sous-titres), en data: URL
}

// Une image encodée en data: URL (base64, ~+33%) peut largement dépasser la
// taille du fichier d'origine : le plafond des autres routes (payloads JSON
// de quelques coordonnées) serait bien trop bas ici.
function readBody(req: import('node:http').IncomingMessage, maxBytes = 1_000_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > maxBytes) reject(new Error('Corps de requête trop volumineux'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function loadReviewed(): Promise<string[]> {
  if (!existsSync(REVIEWED)) return [];
  try {
    const parsed = JSON.parse(await readFile(REVIEWED, 'utf8'));
    return Array.isArray(parsed.reviewedIds) ? parsed.reviewedIds : [];
  } catch {
    return [];
  }
}

// Un entier en pourcentage, comme toutes les valeurs déjà présentes dans les
// fichiers de données : le format reste homogène et les diffs lisibles.
function sanitizeBoxes(input: unknown): TemplateBox[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error('Zones manquantes');
  return input.map((b: any) => {
    const num = (v: unknown, min: number, max: number) => {
      const n = Math.round(Number(v));
      if (!Number.isFinite(n)) throw new Error('Coordonnée non numérique');
      return Math.min(max, Math.max(min, n));
    };
    const rotationDeg = num(b.rotationDeg ?? 0, -180, 180);
    return {
      xPct: num(b.xPct, 0, 100),
      yPct: num(b.yPct, 0, 100),
      widthPct: num(b.widthPct, 1, 100),
      heightPct: num(b.heightPct, 1, 100),
      // 0 est omis à l'écriture par formatBox, donc l'inclure ici même à 0
      // ne change rien au fichier — mais un rotationDeg fourni par le client
      // et silencieusement perdu ici serait un bug bien plus difficile à
      // repérer qu'un champ superflu.
      ...(rotationDeg ? { rotationDeg } : {}),
    };
  });
}

export function boxEditorPlugin(): Plugin {
  return {
    name: 'memeit-box-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__boxes/meta', async (_req, res) => {
        const source = await readFile(TEMPLATE_BOXES, 'utf8');
        const curatedIds = [...source.matchAll(/^ {2}'(\d+)':/gm)].map((m) => m[1]);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ curatedIds, reviewedIds: await loadReviewed() }));
      });

      server.middlewares.use('/__boxes/save', async (req, res) => {
        const fail = (code: number, message: string) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: message }));
        };
        if (req.method !== 'POST') return fail(405, 'POST attendu');
        try {
          const payload: SavePayload = JSON.parse(await readBody(req));
          const boxes = sanitizeBoxes(payload.boxes);

          const inlineFile = INLINE_PACK_FILES[payload.pack];
          if (inlineFile) {
            const source = await readFile(inlineFile, 'utf8');
            await writeFile(
              inlineFile,
              writePepitesBoxes(source, payload.id, boxes, path.basename(inlineFile)),
              'utf8'
            );
          } else {
            const imgflipId = payload.id.replace(/^imgflip-/, '');
            const source = await readFile(TEMPLATE_BOXES, 'utf8');
            await writeFile(
              TEMPLATE_BOXES,
              writeCuratedBoxes(source, imgflipId, boxes, payload.name),
              'utf8'
            );
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, boxes }));
        } catch (err) {
          fail(400, err instanceof Error ? err.message : 'Écriture impossible');
        }
      });

      // Supprime un template entier : son entrée dans le pack, son entrée
      // CURATED (si elle existe) et son empreinte. L'image sur le disque
      // n'est pas touchée — la garder rend la suppression réversible (il
      // suffit de rajouter l'entrée), et un fichier orphelin dans
      // public/templates/ ne casse jamais rien.
      //
      // Tout est calculé (et donc validé — les fonctions pures lèvent une
      // erreur au moindre id introuvable) avant la moindre écriture disque :
      // jamais de suppression à moitié faite, qui laisserait par ex. un
      // template retiré du pack mais encore présent dans les empreintes —
      // exactement l'état que gameLogic.test.mts détecte comme "empreintes
      // orphelines".
      server.middlewares.use('/__boxes/delete', async (req, res) => {
        const fail = (code: number, message: string) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: message }));
        };
        if (req.method !== 'POST') return fail(405, 'POST attendu');
        try {
          const payload: DeletePayload = JSON.parse(await readBody(req));
          const rawId = payload.id.replace(/^imgflip-/, '');
          const inlineFile = INLINE_PACK_FILES[payload.pack];
          const packFile = inlineFile ?? CLASSIQUES;

          const packSource = await readFile(packFile, 'utf8');
          const entryCount = inlineFile
            ? [...packSource.matchAll(/^ {4}id: '/gm)].length
            : [...packSource.matchAll(/^ {2}\{ id: '/gm)].length;
          if (entryCount <= 1) throw new Error('Impossible de supprimer le dernier template du pack.');

          const newPackSource = inlineFile
            ? deletePepitesEntry(packSource, payload.id, path.basename(inlineFile))
            : deleteClassiqueEntry(packSource, rawId);

          const fpSource = await readFile(FINGERPRINTS, 'utf8');
          const newFpSource = deleteFingerprintEntry(fpSource, payload.id);

          let newTbSource: string | null = null;
          if (payload.pack === 'classiques') {
            const tbSource = await readFile(TEMPLATE_BOXES, 'utf8');
            const stripped = deleteCuratedBoxes(tbSource, rawId);
            if (stripped !== tbSource) newTbSource = stripped;
          }

          const reviewed = new Set(await loadReviewed());
          const reviewedChanged = reviewed.delete(payload.id);

          await writeFile(packFile, newPackSource, 'utf8');
          await writeFile(FINGERPRINTS, newFpSource, 'utf8');
          if (newTbSource !== null) await writeFile(TEMPLATE_BOXES, newTbSource, 'utf8');
          if (reviewedChanged) {
            await writeFile(
              REVIEWED,
              `${JSON.stringify({ reviewedIds: [...reviewed].sort() }, null, 2)}\n`,
              'utf8'
            );
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          fail(400, err instanceof Error ? err.message : 'Suppression impossible');
        }
      });

      // Incruste des sous-titres à demeure dans le fichier image : écrase
      // public/templates/<fichier> avec l'image déjà composée côté client
      // (canvas), puis recalcule son empreinte. Contrairement à /save et
      // /delete, ceci ne touche aucun fichier source TypeScript — seul le
      // binaire de l'image change, à un chemin déjà connu du pack.
      server.middlewares.use('/__boxes/bake-text', async (req, res) => {
        const fail = (code: number, message: string) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: message }));
        };
        if (req.method !== 'POST') return fail(405, 'POST attendu');
        try {
          const payload: BakeTextPayload = JSON.parse(await readBody(req, 25_000_000));

          // Le chemin cible doit rester un fichier direct de public/templates/
          // — pas de ".." ni de séparateur supplémentaire — avant même de le
          // résoudre, pour qu'aucune donnée du client ne puisse faire écrire
          // en dehors de ce dossier.
          const match = /^\/templates\/([a-zA-Z0-9._-]+\.(?:jpg|jpeg|png))$/.exec(payload.url || '');
          if (!match) throw new Error(`url de template invalide : ${payload.url}`);
          const target = path.join(TEMPLATES_DIR, match[1]);
          if (path.dirname(target) !== TEMPLATES_DIR) throw new Error('Chemin de template invalide');

          const dataMatch = /^data:[^;]+;base64,(.+)$/.exec(payload.dataUrl || '');
          if (!dataMatch) throw new Error('Image manquante ou mal encodée');
          const buf = Buffer.from(dataMatch[1], 'base64');

          await writeFile(target, buf);

          const fingerprint = await fingerprintBuffer(buf);
          const fpSource = await readFile(FINGERPRINTS, 'utf8');
          await writeFile(FINGERPRINTS, upsertFingerprintEntry(fpSource, payload.id, fingerprint), 'utf8');

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          fail(400, err instanceof Error ? err.message : 'Incrustation impossible');
        }
      });

      // Marque un template comme « relu visuellement ». Utile surtout pour les
      // templates restés sur la disposition générique : sans ça, rien ne
      // distingue « vérifié, c'est bon » de « jamais regardé ».
      server.middlewares.use('/__boxes/reviewed', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('POST attendu');
        }
        const { id, reviewed } = JSON.parse(await readBody(req));
        const ids = new Set(await loadReviewed());
        if (reviewed) ids.add(id);
        else ids.delete(id);
        const sorted = [...ids].sort();
        await writeFile(REVIEWED, `${JSON.stringify({ reviewedIds: sorted }, null, 2)}\n`, 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, reviewedIds: sorted }));
      });
    },
  };
}
