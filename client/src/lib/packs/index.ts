import type { Template } from '../../types';
import { CLASSIQUES_TEMPLATES } from './classiques';
import { PEPITES_TEMPLATES } from './pepites';
import { SNAP_TEMPLATES } from './snap';
import { TIKTOK_TEMPLATES } from './tiktok';

export interface TemplatePackMeta {
  id: string;
  name: string;
  description: string;
}

// "Classiques" réunit classiques.ts et pepites.ts : c'était deux packs
// sélectionnables à l'origine, fusionnés depuis (les deux fichiers source
// restent séparés en interne parce que l'éditeur visuel de zones s'appuie
// dessus pour savoir où écrire, mais ça ne concerne plus que l'outillage).
//
// "Snap français" et "TikTok France" sont des packs "faits main" : leurs
// images ne viennent d'aucun catalogue en ligne, elles sont déposées à la
// main (voir npm run templates:snap / templates:tiktok — même mécanisme
// générique, scripts/templates.mts). Chacun ne s'ajoute à la liste que
// lorsqu'il contient au moins un template : vide, il resterait sélectionnable
// dans le lobby pour ne rien donner, et ferait échouer le test "pack non
// vide". Il apparaît donc tout seul le jour où des images arrivent, sans
// rien à rebrancher ici.
const MANUAL_PACKS: (TemplatePackMeta & { templates: Template[] })[] = [
  {
    id: 'snap',
    name: 'Snap français',
    description: 'Des memes bien de chez nous, absents d\'Imgflip',
    templates: SNAP_TEMPLATES,
  },
  {
    id: 'tiktok',
    name: 'TikTok France',
    description: 'Les trends et memes TikTok français des dernières années',
    templates: TIKTOK_TEMPLATES,
  },
];

export const TEMPLATE_PACKS: TemplatePackMeta[] = [
  { id: 'classiques', name: 'Classiques', description: 'Tous les memes cultes intégrés à MemeIt' },
  ...MANUAL_PACKS.filter((p) => p.templates.length).map(({ id, name, description }) => ({ id, name, description })),
];

const PACKS: Record<string, Template[]> = {
  classiques: [...CLASSIQUES_TEMPLATES, ...PEPITES_TEMPLATES],
  ...Object.fromEntries(MANUAL_PACKS.filter((p) => p.templates.length).map((p) => [p.id, p.templates])),
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
