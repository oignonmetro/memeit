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
import { writeCuratedBoxes, writePepitesBoxes } from './boxWriter.mts';
import type { TemplateBox } from '../src/types.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.join(HERE, '..');
const TEMPLATE_BOXES = path.join(CLIENT, 'src', 'lib', 'templateBoxes.ts');
const PEPITES = path.join(CLIENT, 'src', 'lib', 'packs', 'pepites.ts');
const REVIEWED = path.join(HERE, 'boxes-reviewed.json');

interface SavePayload {
  pack: 'classiques' | 'pepites';
  id: string; // id du template dans le pack (imgflip-… ou pepites-…)
  name: string;
  boxes: TemplateBox[];
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1_000_000) reject(new Error('Corps de requête trop volumineux'));
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
    return {
      xPct: num(b.xPct, 0, 100),
      yPct: num(b.yPct, 0, 100),
      widthPct: num(b.widthPct, 1, 100),
      heightPct: num(b.heightPct, 1, 100),
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

          if (payload.pack === 'pepites') {
            const source = await readFile(PEPITES, 'utf8');
            await writeFile(PEPITES, writePepitesBoxes(source, payload.id, boxes), 'utf8');
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
