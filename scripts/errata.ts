// Writes the section of docs/ldraw-errata.md on the errata Kinebrick applies to the OMR's model
// files (data/errata/<set>.json; see src/errata.ts), between its markers: from the entries, never
// by hand. tests/errata.test.ts checks that the page is up to date.
//
//   npm run errata

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { Errata, Erratum } from '../src/errata.ts';

export const PAGE = 'docs/ldraw-errata.md';
export const START = '<!-- errata: from data/errata/*.json by npm run errata, not by hand -->';
export const END = '<!-- errata: end -->';

const status = (e: Erratum) => (e.signedOff ? `Signed off by ${e.signedOff.by}, ${e.signedOff.date}` : 'Proposed, not applied until signed off');

function what(e: Erratum): string {
  if (e.what === 'add') return `adds ${e.lines?.length ?? 0} line${e.lines?.length === 1 ? '' : 's'} to the main model`;
  const placed = (e.line ?? '').trim().split(/\s+/).slice(14).join(' ');
  return `moves \`${placed}\`${e.file ? ` (in \`${e.file}\`)` : ''} to ${e.position?.join(' ') ?? 'where it was'}${e.orientation ? ', turned' : ''}`;
}

// The section, as the entries make it.
export function errataSection(): string {
  const all: Errata[] = readdirSync('data/errata')
    .filter((f) => f.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((f) => JSON.parse(readFileSync(`data/errata/${f}`, 'utf-8')));
  const out = [START, '', '## Corrections Kinebrick applies to the OMR files', '', "The OMR's model files aren't Kinebrick's to edit, so Kinebrick reads a set's file with these corrections (data/errata/<set>.json), in the viewer, the function check and every script alike. A file you open yourself is never corrected. An entry is applied once Erik has signed it off; a proposed one only when asked for (the check's `--proposed`, the viewer's `option=proposed`), to see the set before and after. No part number moves: a moved part keeps its number, and an added part is numbered after the model's last part.", ''];
  out.push('| Set | Entry | What it does | Status |', '| --- | --- | --- | --- |');
  for (const set of all) for (const e of set.entries) out.push(`| [${set.set}](#${set.set}-${e.id}) | ${e.id} | ${what(e)} | ${status(e)} |`);
  for (const set of all) {
    for (const e of set.entries) {
      out.push('', `### ${set.set}: ${e.id}`, '', `${status(e)}.`, '', e.evidence);
      if (e.what === 'move') out.push('', `In ${e.file ? `\`${e.file}\`` : 'the main model'}${e.part ? ` (${e.part})` : ''}, the line`, '', '```', e.line ?? '', '```', '', `is read with its part at ${e.position?.join(' ')}${e.orientation ? `, turned to ${e.orientation.join(' ')}` : ''}.`);
      if (e.what === 'add') out.push('', 'Added to the main model:', '', '```', ...(e.lines ?? []), '```');
      if (e.note) out.push('', e.note);
    }
  }
  out.push('', END);
  return out.join('\n');
}

// The page with its section written afresh: after the hand-written part, in place of the old.
export function pageWithSection(page: string): string {
  const start = page.indexOf(START);
  const end = page.indexOf(END);
  const before = start < 0 ? page.trimEnd() + '\n\n' : page.slice(0, start);
  const after = start < 0 || end < 0 ? '\n' : page.slice(end + END.length);
  return before + errataSection() + after;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(PAGE, pageWithSection(readFileSync(PAGE, 'utf-8')));
  console.log(`Wrote the errata section of ${PAGE}`);
}
