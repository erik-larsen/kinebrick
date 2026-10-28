// Reads a model file as the viewer does, for the scripts that work its controls (probe-joints.ts,
// check-functions.ts): one of KineBrick's own in models/, with its connection table and packed
// pieces, or (`omr`) a set from the OMR in omr/, as a model you open yourself would be read, with
// the whole LDraw library's table and primitives. Its mechanism, and its kinematics ready to move.

import { readFileSync } from 'node:fs';
import { ConnectionTable, libraryConnections } from '../src/connections.ts';
import { DEFAULT_SCRUB, Kinematics } from '../src/kinematics.ts';
import { modelSettings, parseModel, PlacedPart } from '../src/ldr.ts';
import { inferMechanism } from '../src/mechanism.ts';

export function loadModel(file: string, omr: boolean, status: (now: string) => void = () => {}) {
  status('reading it');
  const text = readFileSync(file, 'utf-8');
  const name = file.replace(/^.*[\\/]/, '').replace(/\.(ldr|mpd)$/i, '');
  const roles: Record<string, string> = JSON.parse(readFileSync('data/roles.json', 'utf-8'));
  const packedModels: Record<string, { primitives: string[]; pieces: Record<string, string[]> }> = JSON.parse(readFileSync('packed/models.json', 'utf-8'));
  let table: ConnectionTable;
  let isPrimitive: (n: string) => boolean;
  let piecesOf: (n: string) => string[] | null;
  if (omr) {
    table = libraryConnections(JSON.parse(readFileSync('data/library-connections.json', 'utf-8')));
    const primitives = new Set<string>(JSON.parse(readFileSync('packed/primitives.json', 'utf-8')));
    // The parts read as their pieces: every such part in the library.
    const pieces: Record<string, string[]> = JSON.parse(readFileSync('packed/pieces.json', 'utf-8'));
    isPrimitive = (n) => primitives.has(n);
    piecesOf = (n) => pieces[n] ?? null;
  } else {
    table = JSON.parse(readFileSync('data/connections.json', 'utf-8'));
    const packed = packedModels[name];
    const primitives = new Set(packed?.primitives ?? []);
    isPrimitive = (n) => primitives.has(n);
    piecesOf = (n) => packed?.pieces[n] ?? null;
  }
  const { parts, paths } = parseModel(text, isPrimitive, piecesOf);
  status('working out its mechanism');
  // The mechanism of the parts placed as given, ready to move: the model's own, or worked out
  // afresh after a shift moved some of them, as the viewer does.
  const read = (placed: PlacedPart[]) => {
    const mech = inferMechanism(placed, table, roles, paths);
    const kin = new Kinematics(mech);
    kin.scrub = (modelSettings(text).scrub ?? DEFAULT_SCRUB * 100) / 100;
    return { parts: placed, mech, kin };
  };
  return { name, table, slides: modelSettings(text).slides, ...read(parts), read };
}
