// Reads a model file as the viewer does, for the scripts that work its controls (probe-joints.ts,
// check-functions.ts): one of Kinebrick's own in models/, with its connection table and packed
// pieces, or (`omr`) a set from the OMR in omr/, as a model you open yourself would be read, with
// the whole LDraw library's table and primitives. Its mechanism, and its kinematics ready to move.

import { existsSync, readFileSync } from 'node:fs';
import { applyErrata, type Errata, setOfFile } from '../src/errata.ts';
import { ConnectionTable, libraryConnections } from '../src/connections.ts';
import { DEFAULT_SCRUB, Kinematics } from '../src/kinematics.ts';
import { embeddedParts, modelSettings, parseModel, PlacedPart } from '../src/ldr.ts';
import { keptFileName, type PartMesh, touchingFrom } from '../src/collisions.ts';
import { partShapes } from './part-shapes.ts';
import { inferMechanism } from '../src/mechanism.ts';
import { pivotsKey } from '../src/pivotsKey.ts';
import { isLayout } from '../src/track.ts';
import { drawnDirectly, piecesLines, piecesRole } from '../src/pack.ts';

// The parts' shapes are read with it (see partShapes), for what its loose parts touch (see
// touchingFrom, decision 259): or given, by a caller that has read them already.
export async function loadModel(file: string, omr: boolean, status: (now: string) => void = () => {}, shapes?: { shape: PartMesh[] }[]) {
  status('reading it');
  const { text, table, parts, paths, errata } = readParts(file, omr);
  status('reading its parts\' shapes');
  const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
  // (On a train layout, as its collision test has them: see isLayout.)
  const touching = touchingFrom((shapes ?? (await partShapes(file, text, parts))).map((s) => s.shape), parts.map((p) => p.matrix), isLayout(parts, roles));
  const name = file.replace(/^.*[\\/]/, '').replace(/\.(ldr|mpd)$/i, '');
  status('working out its mechanism');
  const kept = keptPivots(file, parts, table, roles);
  // The mechanism of the parts placed as given, ready to move: the model's own, or worked out
  // afresh after a shift moved some of them, as the viewer does; with the friction pins `freed`
  // left to turn (see pinsToFree), and the parts `slid` asked to slide on their axles (see
  // slidesAsked).
  const read = (placed: PlacedPart[], freed = new Set<number>(), slid = new Set<number>()) => {
    const mech = inferMechanism(placed, table, roles, paths, freed, false, placed === parts ? kept : null, slid, touching);
    const kin = new Kinematics(mech);
    kin.scrub = (modelSettings(text).scrub ?? DEFAULT_SCRUB * 100) / 100;
    return { parts: placed, mech, kin };
  };
  // The mechanism with every friction pin free, for pinsToFree.
  const allFree = (placed: PlacedPart[]) => inferMechanism(placed, table, roles, paths, new Set(), true, null, new Set(), touching);
  return { name, table, errata, slides: modelSettings(text).slides, ...read(parts), read, allFree, touching };
}

// The pins the rule for stuck actuators frees in the model, as kept for it (see keptPivots.ts in
// src/, and npm run pivots), if its kept file's key matches; null if not, and the rule is
// worked out as the model is read. KINEBRICK_KEPT_PIVOTS=0 always works it out, for comparing.
export function keptPivots(file: string, parts: PlacedPart[], table: ConnectionTable, roles: Record<string, string>): number[] | null {
  const kept = `data/pivots/${keptFileName(file)}.json`;
  if (process.env.KINEBRICK_KEPT_PIVOTS === '0' || !existsSync(kept)) return null;
  const { key, pins } = JSON.parse(readFileSync(kept, 'utf-8'));
  return key === pivotsKey(parts, table, roles) ? pins : null;
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
  // A model's text's parts read as their pieces, given that text (see piecesFor below).
  let piecesFor: (text: string) => (n: string) => string[] | null = () => (n) => piecesOf(n);
  if (omr) {
    table = libraryConnections(JSON.parse(readFileSync('data/library-connections.json', 'utf-8')));
    const primitives = new Set<string>(JSON.parse(readFileSync('packed/primitives.json', 'utf-8')));
    // The parts read as their pieces: every such part in the library.
    const pieces: Record<string, string[]> = JSON.parse(readFileSync('packed/pieces.json', 'utf-8'));
    isPrimitive = (n) => drawnDirectly(n, primitives);
    piecesOf = (n) => pieces[n] ?? null;
    // A part the OMR embeds in the model's file ("42108 - 40918-f1.dat") is read as its pieces if
    // the library's part of that name is, and as the model file's own text has them, as the viewer
    // reads it (piecesRole and piecesLines in src/pack.ts): the 42099 embeds its 46490c01 hubs
    // built of "42099 - u9475", where the library's have 46434.
    const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
    piecesFor = (text) => {
      const embedded = embeddedParts(text);
      return (n) => {
        if (!embedded.has(n)) return pieces[n] ?? null;
        const role = piecesRole(n, roles, embedded);
        return role ? piecesLines(role, embedded.get(n)!) : null;
      };
    };
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
  const partAt = (n: number) => (asIs ??= parseModel(original, isPrimitive, piecesFor(original)).parts)[n]?.name;
  const { text, applied, refused } = applyErrata(original, errata, process.env.KINEBRICK_PROPOSED === '1', partAt);
  const { parts, paths } = parseModel(text, isPrimitive, piecesFor(text));
  return { text, table, parts, paths, errata: { applied, refused } };
}

// The errata for the set a model file is of (data/errata/<set>.json), or null.
export function readErrata(file: string): Errata | null {
  const set = setOfFile(file);
  const path = set ? `data/errata/${set}.json` : '';
  return set && existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : null;
}
