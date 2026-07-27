// Personal template pack: images the player has added, kept on their own
// device (IndexedDB) so they persist across rooms and games without needing
// an account. Exportable/importable as a JSON file so the player can back
// up their pack or move it to another device/browser.

export interface PersonalTemplate {
  id: string;
  name: string;
  dataUrl: string;
  addedAt: number;
}

const DB_NAME = 'memeit';
const STORE = 'templatePack';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB indisponible.'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Opération IndexedDB échouée.'));
  });
}

export async function listPersonalTemplates(): Promise<PersonalTemplate[]> {
  const all = await withStore<PersonalTemplate[]>('readonly', (store) => store.getAll());
  return all.sort((a, b) => a.addedAt - b.addedAt);
}

export async function addPersonalTemplate(name: string, dataUrl: string): Promise<PersonalTemplate> {
  const template: PersonalTemplate = {
    id: crypto.randomUUID(),
    name: name || 'Template perso',
    dataUrl,
    addedAt: Date.now(),
  };
  await withStore('readwrite', (store) => store.put(template));
  return template;
}

export async function removePersonalTemplate(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id));
}

export async function exportPackJson(): Promise<string> {
  const templates = await listPersonalTemplates();
  return JSON.stringify({ kind: 'memeit-template-pack', version: 1, templates }, null, 2);
}

export async function importPackJson(json: string): Promise<{ added: number; skipped: number }> {
  const parsed = JSON.parse(json);
  const incoming: PersonalTemplate[] = Array.isArray(parsed) ? parsed : parsed?.templates;
  if (!Array.isArray(incoming)) throw new Error('Fichier de pack invalide.');
  const existing = new Set((await listPersonalTemplates()).map((t) => t.id));
  let added = 0;
  let skipped = 0;
  for (const t of incoming) {
    if (!t || typeof t.dataUrl !== 'string') {
      skipped += 1;
      continue;
    }
    if (t.id && existing.has(t.id)) {
      skipped += 1;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    await withStore('readwrite', (store) =>
      store.put({
        id: typeof t.id === 'string' ? t.id : crypto.randomUUID(),
        name: typeof t.name === 'string' ? t.name : 'Template perso',
        dataUrl: t.dataUrl,
        addedAt: typeof t.addedAt === 'number' ? t.addedAt : Date.now(),
      })
    );
    added += 1;
  }
  return { added, skipped };
}
