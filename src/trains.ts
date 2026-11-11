// The train sets in the viewer: the Trains group in the model menu, and the switches on their
// track, which a click flips.
//
// A train set is one of the models in models/trains/ (made by scripts/train-layouts.ts from the
// OMR's files). It opens as a model opened from your own computer does: the viewer packs it
// itself, with the parts it uses fetched from the LDraw library (see library.ts), so the site
// needn't carry a packed copy of each.

import { BufferGeometry, Group, Line, LineBasicMaterial, Vector3 } from 'three';
import type { Mechanism } from './mechanism.ts';

const urls: Record<string, string> = import.meta.glob('../models/trains/*.mpd', { query: '?url', import: 'default', eager: true });

// Each train set's file name in models/trains/ (e.g. "4563-Load and Haul Railroad.mpd"), and its
// name in the menu, in order of set number.
export const TRAIN_SETS: [string, string][] = Object.keys(urls)
  .map((path): [string, string] => {
    const file = path.replace(/^.*\//, '');
    return [file, file.replace(/\.mpd$/, '').replace(/^(\d+)-/, '$1 ')];
  })
  .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));

// The train set the address names (?train=4563-Load and Haul Railroad.mpd), if there is one.
const named = new URLSearchParams(window.location.search).get('train');
export const TRAIN = TRAIN_SETS.some(([file]) => file === named) ? named : null;

// A train set's model file, as text.
export async function trainText(file: string): Promise<string> {
  return (await fetch(urls[`../models/trains/${file}`])).text();
}

// How the switches show which way they're set: each switch's route through it drawn as a line
// along the rail heads, bright the way it's set and faint the other way.
const SET = new LineBasicMaterial({ color: 0xffd400, depthTest: false, transparent: true });
const UNSET = new LineBasicMaterial({ color: 0x808080, depthTest: false, transparent: true, opacity: 0.4 });

export function switchMarks(mech: Mechanism): Group {
  const group = new Group();
  const track = mech.track;
  if (!track) return group;
  for (const s of track.switches) {
    for (const line of s.lines) {
      const points: Vector3[] = [];
      const length = track.lines[line].length;
      for (let i = 0; i <= 32; i++) points.push(track.pointAt(line, (length * i) / 32).point.add(new Vector3(0, -2, 0)));
      const mark = new Line(new BufferGeometry().setFromPoints(points), UNSET);
      mark.userData = { part: s.part, line };
      mark.renderOrder = 10;
      group.add(mark);
    }
  }
  showSwitches(mech, group);
  return group;
}

function showSwitches(mech: Mechanism, marks: Group) {
  for (const mark of marks.children as Line[]) {
    const s = mech.track!.switchOf(mark.userData.part)!;
    mark.material = s.lines[s.state] === mark.userData.line ? SET : UNSET;
  }
}

// A click on a switch flips it: what to say about it, or null if the part isn't a switch.
export function flipSwitch(mech: Mechanism, marks: Group, part: number): string | null {
  const s = mech.track?.switchOf(part);
  if (!s) return null;
  mech.track!.flip(part);
  showSwitches(mech, marks);
  return `Switch set ${s.state === 0 ? 'straight' : 'to the branch'} · click again to flip it back`;
}
