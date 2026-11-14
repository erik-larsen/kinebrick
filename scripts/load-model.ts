// Reads a model file as the viewer does, for the scripts that work its controls (probe-joints.ts,
// check-functions.ts): one of Kinebrick's own in models/, with its connection table and packed
// pieces, or (`omr`) a set from the OMR in omr/, as a model you open yourself would be read, with
// the whole LDraw library's table and primitives. Its mechanism, and its kinematics ready to move.

import { existsSync, readFileSync } from 'node:fs';
import { applyErrata, type Errata, setOfFile } from '../src/errata.ts';
import { ConnectionTable, libraryConnections } from '../src/connections.ts';
import { DEFAULT_SCRUB, Kinematics } from '../src/kinematics.ts';
import { modelSettings, parseModel, PlacedPart } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';
import { drawnDirectly } from '../src/pack.ts';

export function loadModel(file: string, omr: boolean, status: (now: string) => void = () => {}) {
  status('reading it');
  const { text, table, parts, paths, errata } = readParts(file, omr);
  const name = file.replace(/^.*[\\/]/, '').replace(/\.(ldr|mpd)$/i, '');
  const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
  status('working out its mechanism');
  // The mechanism of the parts placed as given, ready to move: the model's own, or worked out
  // afresh after a shift moved some of them, as the viewer does; with the friction pins `freed`
  // left to turn (see pinsToFree).
  const read = (placed: PlacedPart[], freed = new Set<number>()) => {
    const mech = inferMechanism(placed, table, roles, paths, freed);
    const kin = new Kinematics(mech);
    kin.scrub = (modelSettings(text).scrub ?? DEFAULT_SCRUB * 100) / 100;
    return { parts: placed, mech, kin };
  };
  // The mechanism with every friction pin free, for pinsToFree.
  const allFree = (placed: PlacedPart[]) => inferMechanism(placed, table, roles, paths, new Set(), true);
  return { name, table, errata, slides: modelSettings(text).slides, ...read(parts), read, allFree };
}

// A model's parts, in the order the scripts number them ("p483 3736"), with its connection table:
// read as loadModel reads them, without working out its mechanism.
export function readParts(file: string, omr: boolean) {
  const original = readFileSync(file, 'utf-8');
  const name = file.replace(/^.*[\\/]/, '').replace(/\.(ldr|mpd)$/i, '');
  const packedModels: Record<string, { primitives: string[]; pieces: Record<string, string[]> }> = JSON.parse(readFileSync('packed/models.json', 'utf-8'));
  let table: ConnectionTable;
  let isPrimitive: (n: string) => boolean;
  let piecesOf: (n: string) => string[] | null;
  if (omr) {
    table = libraryConnections(JSON.parse(readFileSync('data/library-connections.json', 'utf-8')));
    const primitives = new Set<string>(JSON.parse(readFileSync('packed/primitives.json', 'utf-8')));
    // The parts read as their pieces: every such part in the library.
    const pieces: Record<string, string[]> = JSON.parse(readFileSync('packed/pieces.json', 'utf-8'));
    isPrimitive = (n) => drawnDirectly(n, primitives);
    // A part the OMR embeds in the model's file ("42108 - 40918-f1.dat") is read as its pieces if
    // the library's part of that name is (see libraryName in src/mechanism.ts).
    piecesOf = (n) => pieces[n] ?? (table.parts[n] ? null : pieces[/ - ([^/]+)$/.exec(n)?.[1] ?? '']) ?? null;
  } else {
    table = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
    const packed = packedModels[name];
    const primitives = new Set(packed?.primitives ?? []);
    isPrimitive = (n) => primitives.has(n);
    piecesOf = (n) => packed?.pieces[n] ?? null;
  }
  // A set's model file is read with its errata (src/errata.ts); with KINEBRICK_PROPOSED=1 (the
  // check's --proposed), those not yet signed off too.
  const errata = readErrata(file);
  let asIs: PlacedPart[] | null = null;
  const partAt = (n: number) => (asIs ??= parseModel(original, isPrimitive, piecesOf).parts)[n]?.name;
  const { text, applied, refused } = applyErrata(original, errata, process.env.KINEBRICK_PROPOSED === '1', partAt);
  const { parts, paths } = parseModel(text, isPrimitive, piecesOf);
  return { text, table, parts, paths, errata: { applied, refused } };
}

// The errata for the set a model file is of (data/errata/<set>.json), or null.
export function readErrata(file: string): Errata | null {
  const set = setOfFile(file);
  const path = set ? `data/errata/${set}.json` : '';
  return set && existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : null;
}
