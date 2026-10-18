// Brings the real LEGO sets in models/ into the shape KineBrick keeps them in (see importSet in
// src/ldr.ts). A set's file as downloaded from the LDraw Official Model Repository, named like
// "956 - Auto Chassis.mpd", becomes "956-Auto Chassis.mpd", replacing any older copy, and every
// set gets KineBrick's own lines for it from models/sets.json. A set new to sets.json gets an
// empty entry there. Sets already imported are left as they are.
//
// Run with: npm run import (npm run data runs it first)

import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { importSet } from '../src/ldr.ts';

const MODELS_DIR = 'models';
const SETS = join(MODELS_DIR, 'sets.json');

const sets: Record<string, string[]> = JSON.parse(readFileSync(SETS, 'utf-8'));
let newSets = false;

// A set's file starts with its set number: "956 - Auto Chassis.mpd" or "956-Auto Chassis.mpd".
for (const file of readdirSync(MODELS_DIR).sort()) {
  const set = /^(\d+)(?: - |-).*\.mpd$/.exec(file)?.[1];
  if (!set) continue;
  const name = file.replace(/ - /g, '-').replace(/\.mpd$/, '');
  if (!(name in sets)) {
    sets[name] = [];
    newSets = true;
  }
  const text = readFileSync(join(MODELS_DIR, file), 'utf-8');
  const out = importSet(text, set, sets[name]);
  if (file !== `${name}.mpd`) {
    rmSync(join(MODELS_DIR, file));
    writeFileSync(join(MODELS_DIR, `${name}.mpd`), out);
    console.log(`Imported ${file} as ${name}.mpd`);
  } else if (out !== text) {
    writeFileSync(join(MODELS_DIR, file), out);
    console.log(`Updated ${file} from ${SETS}`);
  }
}

for (const name of Object.keys(sets)) {
  if (!readdirSync(MODELS_DIR).includes(`${name}.mpd`)) console.log(`${SETS} has ${name}, which isn't in ${MODELS_DIR}/`);
}
if (newSets) {
  writeFileSync(SETS, JSON.stringify(sets, null, 2) + '\n');
  console.log(`Added the new sets to ${SETS}`);
}
