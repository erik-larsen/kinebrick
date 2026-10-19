import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConnectionTable, libraryConnections } from '../src/connections.ts';
import { modelFiles } from '../src/ldr.ts';
import { packModel } from '../src/pack.ts';

// A model opened from your own computer is packed in the browser, its parts fetched from an LDraw
// library online, and connected by the table for the whole library. Opening one of KineBrick's
// own model files that way must give what its packed copy gives.

const table: ConnectionTable = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
const library = libraryConnections(JSON.parse(readFileSync('data/library-connections.json', 'utf-8')));
const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
const primitives = new Set<string>(JSON.parse(readFileSync('packed/primitives.json', 'utf-8')));
const colours = readFileSync('packed/colours.ldr', 'utf-8').trimEnd();

describe('the table for the whole library', () => {
  it("has every part of KineBrick's own models, with the same connection points", () => {
    for (const [name, cylinders] of Object.entries(table.parts)) expect(library.parts[name] ?? [], name).toEqual(cylinders);
  });

  it('has the same slides, tracks and grooves, and the stickers too', () => {
    expect(library.slides).toEqual(table.slides);
    expect(library.tracks).toEqual(table.tracks);
    expect(library.grooves).toEqual(table.grooves);
    for (const name of table.stickers ?? []) expect(library.stickers).toContain(name);
  });
});

describe('packModel', () => {
  // Packs a model, reading the library's files from its packed copy, which holds every file it
  // uses, but for the parts read as their pieces, whose lines packed/models.json has.
  const models: Record<string, { pieces: Record<string, string[]> }> = JSON.parse(readFileSync('packed/models.json', 'utf-8'));
  const repack = (file: string) => {
    const base = file.replace(/\.(ldr|mpd)$/, '');
    const packed = readFileSync(`packed/${base}.mpd`, 'utf-8');
    const files = modelFiles(packed);
    const readFile = async (name: string) => (files.get(name) ?? files.get('parts/' + name) ?? files.get('p/' + name) ?? models[base].pieces[name])?.join('\n') ?? null;
    return { packed, result: packModel(base, readFileSync(`models/${file}`, 'utf-8'), colours, readFile, (name) => primitives.has(name), roles) };
  };

  for (const file of readdirSync('models').filter((f) => /\.(ldr|mpd)$/.test(f))) {
    it(`packs ${file} as npm run pack did`, async () => {
      const { packed, result } = repack(file);
      const out = await result;
      expect(out.missing).toEqual([]);
      // The library's files end their lines with CR LF, as they come; read back here, with LF.
      const want = packed.replaceAll('\r\n', '\n').split('\n');
      const got = out.text.split('\n');
      const differs = want.findIndex((line, i) => line !== got[i]);
      expect(differs === -1 ? null : { line: differs + 1, want: want[differs], got: got[differs] }).toBe(null);
      expect(got.length).toBe(want.length);
    });
  }

  it('packs files it can’t find empty, and lists them', async () => {
    const out = await packModel('test', '1 4 0 0 0 1 0 0 0 1 0 0 0 1 nothing.dat', '', async () => null, () => false, {});
    expect(out.missing).toEqual(['nothing.dat']);
    expect(out.text).toContain('0 FILE nothing.dat\n\n');
  });

  it('names subparts with a small s, as the loader needs', async () => {
    const lib: Record<string, string> = { 'tyre.dat': '0 Tyre\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 S\\tyre1.dat', 's/tyre1.dat': '0 Tyre piece' };
    const out = await packModel('test', '1 0 0 0 0 1 0 0 0 1 0 0 0 1 tyre.dat', '', async (name) => lib[name] ?? null, () => false, {});
    expect(out.missing).toEqual([]);
    expect(out.text).toContain('1 16 0 0 0 1 0 0 0 1 0 0 0 1 s\\tyre1.dat');
    expect(out.text).toContain('0 FILE parts/s/tyre1.dat');
    expect(out.titles['tyre.dat']).toBe('Tyre');
  });
});
