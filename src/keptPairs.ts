// Where the viewer finds the first collision pass's result without doing it (see nearPairsOf in
// collisions.ts): for the models Kinebrick ships, kept files (data/collisions/<model>.json, made
// by npm run collisions); for a file you open yourself, this browser's own store (IndexedDB), filed
// under the same key. With neither, or a key that doesn't match, the pass is done as ever.

import { collisionKey, keptFileName } from './collisions.ts';

const keptFiles = import.meta.glob('../data/collisions/*.json', { import: 'default' }) as Record<string, () => Promise<{ key: string; near: [number, number][]; release?: string }>>;
const release = import.meta.glob('../data/collisions/library.json', { eager: true, import: 'default' }) as Record<string, { release: string }>;

// What's known of a model: the pairs tested (all those whose boxes meet, for a kept file), and
// which of them are near.
export interface KnownPairs {
  all: boolean; // every pair whose boxes meet was tested
  tested: [number, number][];
  near: [number, number][];
}

// The key for a model's text as the viewer reads it.
export const keyFor = (modelText: string) => collisionKey(modelText, release['../data/collisions/library.json']?.release ?? '');

// The kept file's result for the model named `name` (its file's name, without .mpd or .ldr), if
// its key is `key`.
export async function keptPairs(name: string, key: string): Promise<KnownPairs | null> {
  const load = keptFiles[`../data/collisions/${keptFileName(name)}.json`];
  if (!load) return null;
  try {
    const kept = await load();
    return kept.key === key ? { all: true, tested: [], near: kept.near } : null;
  } catch {
    return null;
  }
}

// This browser's own store: one record per key.
function store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('kinebrick', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('collisions');
    open.onsuccess = () => resolve(open.result.transaction('collisions', mode).objectStore('collisions'));
    open.onerror = () => reject(open.error);
  });
}

export async function storedPairs(key: string): Promise<KnownPairs | null> {
  try {
    const s = await store('readonly');
    return await new Promise((resolve) => {
      const get = s.get(key);
      get.onsuccess = () => resolve((get.result as KnownPairs | undefined) ?? null);
      get.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function storePairs(key: string, known: KnownPairs): Promise<void> {
  try {
    (await store('readwrite')).put(known, key);
  } catch {
    // A browser that keeps nothing (a private window) does the pass each time.
  }
}
