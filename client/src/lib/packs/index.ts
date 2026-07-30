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
// live Imgflip fetch. Falls back to "classiques" for an unknown/removed id
// (e.g. a room created before a pack was renamed or retired).
export function getPackTemplates(packId: string): Template[] {
  return PACKS[packId] || PACKS[DEFAULT_PACK_ID];
}
