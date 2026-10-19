// Models opened from your own computer. The site has no LDraw parts library of its own (each of
// KineBrick's models comes packed with the parts it uses, see src/pack.ts), so the viewer packs
// such a model itself, fetching the parts it uses from an LDraw library online, and keeps the
// file in the browser, so the page can reload with it.

// A copy of the LDraw parts library, kept up to date from ldraw.org's complete.zip (whose own
// site doesn't let other sites fetch from it), in the erik-larsen/ldraw repository, published on
// the same site as KineBrick. Parts newer than its last update are missing; a model file may
// bring those with it.
export const LDRAW_LIBRARY = 'https://erik-larsen.github.io/ldraw/';

// The browser's Cache Storage: where opened files are kept, and parts once fetched, so they
// needn't be fetched again. Only on pages served securely (https, or localhost); elsewhere
// nothing is kept.
const FILES_CACHE = 'kinebrick-files';
const PARTS_CACHE = 'kinebrick-ldraw';

// Where an opened file is kept, by its name.
function fileKey(name: string): string {
  return new URL('opened/' + encodeURIComponent(name), window.location.href).href;
}

export async function keepFile(name: string, text: string): Promise<void> {
  if (!('caches' in window)) throw new Error('this browser keeps no files for pages served like this one (it needs https)');
  await (await caches.open(FILES_CACHE)).put(fileKey(name), new Response(text));
}

// The file kept by that name, or null if there's none (it was opened in another browser, or the
// browser has cleared it since).
export async function keptFile(name: string): Promise<string | null> {
  if (!('caches' in window)) return null;
  const kept = await (await caches.open(FILES_CACHE)).match(fileKey(name));
  return kept ? kept.text() : null;
}

// Reads files from the LDraw library at `url`: a primitive (one of `primitives`, as models name
// them) from its p/ folder, anything else from parts/. Gives null for a file the library hasn't
// got. `onFetched` is told how many files it has read so far.
export function libraryReader(url: string, primitives: Set<string>, onFetched: (count: number) => void): (name: string) => Promise<string | null> {
  let count = 0;
  const parts = 'caches' in window ? caches.open(PARTS_CACHE) : null;
  return async (name) => {
    const address = url + (primitives.has(name) ? 'p/' : 'parts/') + name.split('/').map(encodeURIComponent).join('/');
    const cache = await parts;
    let response = await cache?.match(address);
    if (!response) {
      response = await fetch(address);
      if (!response.ok) return null;
      await cache?.put(address, response.clone());
    }
    onFetched(++count);
    return response.text();
  };
}
