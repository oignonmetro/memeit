import type { Template } from '../../types';
import { CLASSIQUES_TEMPLATES } from './classiques';
import { PEPITES_TEMPLATES } from './pepites';

export interface TemplatePackMeta {
  id: string;
  name: string;
  description: string;
}

// Un seul pack, exposé aux joueurs : "Pépites" a fusionné dedans (les deux
// fichiers source, classiques.ts et pepites.ts, restent séparés en interne —
// l'éditeur visuel de zones s'appuie sur cette séparation pour savoir où
// écrire — mais ça ne concerne plus que l'outillage, plus le jeu).
export const TEMPLATE_PACKS: TemplatePackMeta[] = [
  { id: 'classiques', name: 'Classiques', description: 'Tous les memes cultes intégrés à MemeIt' },
];

const PACKS: Record<string, Template[]> = {
  classiques: [...CLASSIQUES_TEMPLATES, ...PEPITES_TEMPLATES],
};

export const DEFAULT_PACK_ID = 'classiques';

// Pack statique, bundlé — pas d'appel réseau, contrairement à l'ancien fetch
// Imgflip en direct. Une salle créée avant la fusion peut encore avoir
// templatePackIds: ['pepites'] ou ['classiques', 'pepites'] en base : l'id
// "pepites" n'existe plus dans PACKS, il est donc filtré ci-dessous — la
// sélection ne contient alors plus que "classiques" (ou tombe sur le
// fallback si "pepites" était le seul id), qui contient désormais tout.
export function getPackTemplates(packIds: string[]): Template[] {
  const ids = (packIds || []).filter((id) => PACKS[id]);
  const effectiveIds = ids.length ? ids : [DEFAULT_PACK_ID];
  const seen = new Set<string>();
  const templates: Template[] = [];
  for (const id of effectiveIds) {
    for (const t of PACKS[id]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      templates.push(t);
    }
  }
  return templates;
}
