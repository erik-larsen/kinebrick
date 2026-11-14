// Errata: corrections to the OMR's model files of official sets, which aren't Kinebrick's to edit
// (data/errata/<set>.json). A model file of a set is read with its set's errata applied, by the
// check, the viewer and every script that reads a set's model, so they all read the same model.
// A file you open yourself is never corrected.
//
// Each entry changes one type-1 line of the file (a part, or a submodel's placement), named by the
// file it's in (the submodel's name, or "" for the main model) and its full text as the OMR has
// it, compared with its spaces evened out; and by the part number it gives today ("p1059 15458"),
// as people read it and as a second check. An entry whose line isn't found exactly once, or whose
// number no longer names that part, is refused, not applied, and the refusal is reported.
//
// No part number moves: a move changes a line in place; an added line goes after the model's last
// part, the pieces of a split part included (see ADDED in ldr.ts); a removed line is commented out
// (see REMOVED in ldr.ts), the parts it placed keeping their numbers, marked removed: drawn as
// nothing, with no connection points, never loose.
//
// An entry applies only once Erik has signed it off (`signedOff`); with `proposed` (the check's
// --proposed, the viewer's option=proposed) entries not yet signed off apply too, so a set can be
// seen before and after.

import { ADDED, REMOVED } from './ldr.ts';

export interface Erratum {
  id: string; // short and unique within the set, e.g. "hatch-20-high"
  what: 'move' | 'add' | 'remove';
  file?: string; // move, remove: the file the line is in ("" for the main model)
  line?: string; // move, remove: the line, as the OMR file has it
  part?: string; // move, remove: the part number the line gives today, e.g. "p1059 15458"
  position?: [number, number, number]; // move: where the line places its part now
  orientation?: number[]; // move: its orientation's nine numbers, if that changes too
  lines?: string[]; // add: the lines added to the main model
  evidence: string; // the booklet's page and step, or the probe's numbers
  signedOff?: { by: string; date: string; words?: string } | null;
  note?: string;
}

export interface Errata {
  set: string;
  entries: Erratum[];
}

// The set an OMR model file is of, from its name ("omr/42064-1 Ocean Explorer.mpd" is 42064-1), or
// null for any other file.
export function setOfFile(path: string): string | null {
  return /(?:^|[\\/])omr[\\/](\d+-\d+) [^\\/]*\.(?:ldr|mpd)$/i.exec(path)?.[1] ?? null;
}

const even = (line: string) => line.trim().split(/\s+/).join(' ');

// The model's text with the entries applied, which entries were applied and which refused, and
// why. `partAt` gives the name of the part at a number in the model as the OMR file has it (for
// the second check), or null to leave that check out; the caller reads it.
export function applyErrata(text: string, errata: Errata | null | undefined, proposed: boolean, partAt: ((n: number) => string | undefined) | null): { text: string; applied: string[]; refused: string[] } {
  const applied: string[] = [];
  const refused: string[] = [];
  if (!errata) return { text, applied, refused };
  const lines = text.split(/\r?\n/);
  // Which file each line is in: the main model's lines come before the first "0 FILE" line but
  // one (an MPD's first FILE is the main model).
  const fileOf: string[] = [];
  let file = '';
  let files = 0;
  for (const line of lines) {
    const m = /^\s*0\s+FILE\s+(.*\S)\s*$/i.exec(line);
    if (m) file = files++ === 0 ? '' : m[1].toLowerCase();
    fileOf.push(file);
  }
  const added: string[] = [];
  for (const e of errata.entries) {
    if (!e.signedOff && !proposed) continue;
    if (e.what === 'add') {
      added.push(...(e.lines ?? []));
      applied.push(e.id);
      continue;
    }
    if (e.what !== 'move' && e.what !== 'remove') {
      refused.push(`${e.id}: "${e.what}" isn't an erratum Kinebrick knows`);
      continue;
    }
    const want = even(e.line ?? '');
    const where = (e.file ?? '').toLowerCase();
    const found = lines.flatMap((line, i) => (fileOf[i] === where && even(line) === want ? [i] : []));
    if (found.length !== 1) {
      refused.push(`${e.id}: its line is found ${found.length} times in ${e.file || 'the main model'}`);
      continue;
    }
    const number = /^p(\d+)\s+(\S+)/.exec(e.part ?? '');
    if (number && partAt) {
      const now = partAt(Number(number[1]));
      if (!now || now.toLowerCase().replace(/\.dat$/, '') !== number[2].toLowerCase().replace(/\.dat$/, '')) {
        refused.push(`${e.id}: p${number[1]} is ${now ?? 'no part'}, not ${number[2]}`);
        continue;
      }
    }
    if (e.what === 'remove') {
      lines[found[0]] = `${REMOVED} ${lines[found[0]].trim()}`;
      applied.push(e.id);
      continue;
    }
    const tokens = lines[found[0]].trim().split(/\s+/);
    if (e.position) [tokens[2], tokens[3], tokens[4]] = e.position.map(String);
    if (e.orientation) tokens.splice(5, 9, ...e.orientation.map(String));
    lines[found[0]] = tokens.join(' ');
    applied.push(e.id);
  }
  if (added.length) {
    // Added to the main model, after its last line, behind the marker that places them last.
    const end = files > 1 ? fileOf.findIndex((f, i) => i > 0 && f !== '' && fileOf[i - 1] === '') : lines.length;
    const at = end < 0 ? lines.length : end;
    lines.splice(at, 0, ADDED, ...added);
  }
  return { text: lines.join('\n'), applied, refused };
}
