import type { Template } from '../types';
import { FALLBACK_TEMPLATES } from './libraryTemplates';
import { boxesForImgflip } from './templateBoxes';

const IMGFLIP_URL = 'https://api.imgflip.com/get_memes';
// v2: templates now carry predefined text boxes — invalidate any v1 cache.
const CACHE_KEY = 'memeit:imgflip-templates-v2';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — la liste Imgflip elle-même ne bouge que rarement

interface CacheEntry {
  fetchedAt: number;
  templates: Template[];
}

let inMemory: Template[] | null = null;

// Templates les plus populaires du moment sur Imgflip (triés par eux par nombre
// d'utilisations récentes). Mis en cache en localStorage pour éviter un appel réseau
// à chaque partie ; repli sur la petite bibliothèque locale si l'API est injoignable.
export async function getPopularTemplates(): Promise<Template[]> {
  if (inMemory) return inMemory;

  const cached = readCache();
  if (cached) {
    inMemory = cached;
    return cached;
  }

  try {
    const res = await fetch(IMGFLIP_URL);
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data?.memes)) throw new Error('Réponse Imgflip invalide');
    const templates: Template[] = json.data.memes.map((m: any) => ({
      id: `imgflip-${m.id}`,
      url: m.url,
      name: m.name,
      source: 'library' as const,
      boxes: boxesForImgflip(String(m.id), Number(m.box_count) || 2),
    }));
    inMemory = templates;
    writeCache(templates);
    return templates;
  } catch (err) {
    console.warn('Impossible de récupérer les templates Imgflip, repli sur la bibliothèque locale.', err);
    return FALLBACK_TEMPLATES;
  }
}

function readCache(): Template[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (!entry.templates?.length || Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return entry.templates;
  } catch {
    return null;
  }
}

function writeCache(templates: Template[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), templates } satisfies CacheEntry));
  } catch {
    // localStorage plein ou indisponible (navigation privée) — tant pis, pas critique.
  }
}
