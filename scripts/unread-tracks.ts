// A track that isn't read as a track. Kinebrick reads a track from the path it is drawn along
// (LDCad's or LSynth's): the links then run round their wheels. A track drawn link by link, each
// link a part placed by hand, has no path, so its links only ride with whatever they touch, and
// turning a sprocket moves a few links and leaves the rest (the 9391 Crawler Crane). A set with
// such a track must not count as all working, whatever its functions' results (Erik, 2026-11-18):
// its stored results say so, as generated.unreadTracks, and the status page never colours it green.
//
// The function check writes generated.unreadTracks as it stores a set's results. Run by itself,
// this writes it into every set's file without checking anything:
//
//   npx tsx scripts/unread-tracks.ts

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readParts } from './load-model.ts';

// The parts that are links of a track (LDraw's "Technic Chain Tread" parts, and 15379, LDraw's
// alias of 3873). A track is made of
// many of them, so one alone (the 8835 Forklift has one 3873 as a step) is not a track.
const TRACK_LINK = /^(3873|15379|57518(c\d+)?|88323(c\d+)?|69900|69910)\.dat$/;

export interface UnreadTracks {
  links: number; // how many track links are on no path
  parts: string[]; // which parts they are, e.g. ["3873"]
}

// The track links of these models that are on no path, or null if there are none (or one).
export function unreadTracks(models: string[]): UnreadTracks | null {
  let links = 0;
  const kinds = new Set<string>();
  for (const model of new Set(models)) {
    if (!existsSync(model)) continue;
    // Most models have no track link at all: don't read those.
    if (!/\b(3873|15379|57518|88323|69900|69910)(c\d+)?\.dat/i.test(readFileSync(model, 'utf-8'))) continue;
    for (const part of readParts(model, model.startsWith('omr/')).parts) {
      const name = part.name.replace(/^.* - /, '');
      if (!TRACK_LINK.test(name) || part.path) continue;
      links++;
      kinds.add(name.replace(/\.dat$/, ''));
    }
  }
  return links > 1 ? { links, parts: [...kinds].sort() } : null;
}

// The models a set's functions are checked on.
export const modelsOf = (curated: { model: string; functions: { model?: string }[] }) => [curated.model, ...curated.functions.flatMap((fn) => (fn.model ? [fn.model] : []))];

// Run by itself: every set's file gets its generated.unreadTracks, or loses it.
if (process.argv[1]?.endsWith('unread-tracks.ts')) {
  const dir = join('data', 'sets');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const path = join(dir, file);
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    if (!data.generated || !data.curated?.model) continue;
    const unread = unreadTracks(modelsOf(data.curated));
    if (JSON.stringify(unread) === JSON.stringify(data.generated.unreadTracks ?? null)) continue;
    if (unread) data.generated.unreadTracks = unread;
    else delete data.generated.unreadTracks;
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
    console.log(`${data.set}: ${unread ? `${unread.links} track links on no path (${unread.parts.join(', ')})` : 'its tracks are read now'}`);
  }
}
