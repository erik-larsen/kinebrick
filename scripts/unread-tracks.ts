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
import { Vector3 } from 'three';
import { SPROCKETS } from '../src/inference/loops.ts';
import { LINK_FIT, linkKind, type PlacedPart } from '../src/ldr.ts';
import { readParts } from './load-model.ts';

// The parts that are links of a track (LDraw's "Technic Chain Tread" parts, and 15379, LDraw's
// alias of 3873). A track is made of
// many of them, so one alone (the 8835 Forklift has one 3873 as a step) is not a track.
const TRACK_LINK = /^(3873|15379|57518(c\d+)?|88323(c\d+)?|69900|69910)\.dat$/;

export interface UnreadTracks {
  links: number; // how many track links are on no path
  parts: string[]; // which parts they are, e.g. ["3873"]
}

// A closed ring of links shorter than the fewest teeth a sprocket has can't go round a wheel: it
// is no track (the 42069 Extreme Adventure's two squares of four links, high on its body).
const FEWEST_TEETH = Math.min(...Object.values(SPROCKETS).map((s) => s.teeth));

// Of these links (parts of the same model), those in a closed ring of fewer than FEWEST_TEETH:
// each link's pin is on the next one's end, the next being of the same kind, round to the first.
function inShortRings(links: PlacedPart[]): Set<PlacedPart> {
  const end = (p: PlacedPart) => new Vector3().setFromMatrixPosition(p.matrix);
  const next = links.map((p) => {
    const kind = linkKind(p.name)!;
    const pin = kind.pin.clone().applyMatrix4(p.matrix);
    return links.findIndex((q) => q !== p && linkKind(q.name)!.kind === kind.kind && end(q).distanceTo(pin) <= LINK_FIT);
  });
  const short = new Set<PlacedPart>();
  links.forEach((_, first) => {
    const ring = [first];
    for (let i = next[first]; i >= 0 && i !== first && ring.length < FEWEST_TEETH; i = next[i]) ring.push(i);
    if (ring.length < FEWEST_TEETH && next[ring[ring.length - 1]] === first) ring.forEach((i) => short.add(links[i]));
  });
  return short;
}

// The track links of these models that are on no path, or null if there are none (or one).
export function unreadTracks(models: string[]): UnreadTracks | null {
  let links = 0;
  const kinds = new Set<string>();
  for (const model of new Set(models)) {
    if (!existsSync(model)) continue;
    // Most models have no track link at all: don't read those.
    if (!/\b(3873|15379|57518|88323|69900|69910)(c\d+)?\.dat/i.test(readFileSync(model, 'utf-8'))) continue;
    const unread = readParts(model, model.startsWith('omr/')).parts.filter((part) => TRACK_LINK.test(part.name.replace(/^.* - /, '')) && !part.path);
    const short = inShortRings(unread);
    for (const part of unread) {
      if (short.has(part)) continue;
      links++;
      kinds.add(part.name.replace(/^.* - /, '').replace(/\.dat$/, ''));
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
