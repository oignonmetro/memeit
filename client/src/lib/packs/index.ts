import type { Template } from '../../types';
import { CLASSIQUES_TEMPLATES } from './classiques';
import { PEPITES_TEMPLATES } from './pepites';

export interface TemplatePackMeta {
  id: string;
  name: string;
  description: string;
}

export const TEMPLATE_PACKS: TemplatePackMeta[] = [
  { id: 'classiques', name: 'Classiques', description: 'Les ~100 memes les plus utilisés sur Imgflip' },
  { id: 'pepites', name: 'Pépites', description: 'Une sélection de memes cultes en plus des classiques' },
];

const PACKS: Record<string, Template[]> = {
  classiques: CLASSIQUES_TEMPLATES,
  pepites: PEPITES_TEMPLATES,
};

export const DEFAULT_PACK_ID = 'classiques';

// All packs are static, bundled data — no network round-trip, unlike the old
// live Imgflip fetch. The host can select several packs at once; templates
// from every selected pack are pooled together (deduped by id, in case a
// template were ever listed in more than one pack). Unknown/removed ids are
// dropped silently, and an empty selection falls back to "classiques" (e.g.
// a room created before a pack was renamed or retired).
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
