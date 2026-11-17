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
// A submodel placed more than once is one file, so a change to its line changes every use of it.
// An entry with `within` changes only one: it names the placement of its submodel (`file`) in a
// parent, by the parent file and the placement's line, as `file` and `line` name a part. That
// placement is pointed at a copy of the submodel, added at the end of the model under its own name
// (COPY_NAME), and the entry changes the copy's line. Entries with the same `within` share the copy.
// No part number moves: the placement stays where it is, and parts are numbered in the order the
// model places them. (The 42078's two cranes are mirror images that place one actuator submodel
// unmirrored; its axle is right in the front crane and 40 LDU off in the rear one.)
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
  within?: { file: string; line: string }; // move, remove: only `file` as placed by this line of this parent file ("" for the main model)
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

// The name of the copy of submodel `file` that one placement in `parent` is pointed at.
export const COPY_NAME = (file: string, parent: string) => `${file.replace(/\.(ldr|dat)$/i, '')} [as placed in ${parent || 'the main model'}].ldr`;

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
  // The submodels copied for one placement each (see `within`), by the placement.
  const copies = new Map<string, string[]>();
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
    // The lines the entry's line is looked for in: the model's, or a copy of its submodel.
    let target = lines;
    let inFile = (i: number) => fileOf[i] === where;
    if (e.within) {
      const key = `${e.within.file.toLowerCase()}\n${even(e.within.line)}`;
      if (!copies.has(key)) {
        const parent = e.within.file.toLowerCase();
        const placed = lines.flatMap((line, i) => (fileOf[i] === parent && even(line) === even(e.within!.line) ? [i] : []));
        const tokens = placed.length === 1 ? lines[placed[0]].trim().split(/\s+/) : [];
        if (placed.length !== 1 || tokens[0] !== '1' || tokens.slice(14).join(' ').toLowerCase() !== where) {
          refused.push(`${e.id}: its placement of ${e.file} is found ${placed.length} times in ${e.within.file || 'the main model'}${placed.length === 1 ? ', placing something else' : ''}`);
          continue;
        }
        const name = COPY_NAME(e.file ?? '', e.within.file);
        const block = lines.flatMap((line, i) => (fileOf[i] === where ? [line] : []));
        block[0] = `0 FILE ${name}`;
        copies.set(key, block);
        lines[placed[0]] = [...tokens.slice(0, 14), name].join(' ');
      }
      target = copies.get(key)!;
      inFile = () => true;
    }
    const found = target.flatMap((line, i) => (inFile(i) && even(line) === want ? [i] : []));
    if (found.length !== 1) {
      refused.push(`${e.id}: its line is found ${found.length} times in ${e.file || 'the main model'}${e.within ? ` as placed in ${e.within.file || 'the main model'}` : ''}`);
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
      target[found[0]] = `${REMOVED} ${target[found[0]].trim()}`;
      applied.push(e.id);
      continue;
    }
    const tokens = target[found[0]].trim().split(/\s+/);
    if (e.position) [tokens[2], tokens[3], tokens[4]] = e.position.map(String);
    if (e.orientation) tokens.splice(5, 9, ...e.orientation.map(String));
    target[found[0]] = tokens.join(' ');
    applied.push(e.id);
  }
  if (added.length) {
    // Added to the main model, after its last line, behind the marker that places them last.
    const end = files > 1 ? fileOf.findIndex((f, i) => i > 0 && f !== '' && fileOf[i - 1] === '') : lines.length;
    const at = end < 0 ? lines.length : end;
    lines.splice(at, 0, ADDED, ...added);
  }
  for (const block of copies.values()) lines.push('', ...block);
  return { text: lines.join('\n'), applied, refused };
}
