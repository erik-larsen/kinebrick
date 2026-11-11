// The train track as a path (src/track.ts): pieces joined end to end, switches that pick a
// branch, crossings a train keeps straight through, and buffers at the ends.

import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { buildTrack, layOutTrack, Track } from '../src/track.ts';

// A layout of these pieces, laid out end to end, as a track.
function laidOut(names: string[]): Track {
  const placed = layOutTrack(names);
  return buildTrack(names.map((name, i) => ({ name, matrix: placed[i] })))!;
}

// The ends that meet nothing.
const openEnds = (track: Track) => track.links.flat().filter((e) => e.length === 0).length;

// Goes `distance` along the track from the start of a line, and gives the line it ends on.
const lineAfter = (track: Track, line: number, distance: number) => track.walk(line, 0, distance).line;

const CURVE = Math.PI * 800 / 8;

describe('train track', () => {
  it('lays 16 curves and 4 straights out as an oval: every end joined, a lap as long as its pieces', () => {
    const track = laidOut([...new Array(16).fill('74747.dat'), ...new Array(4).fill('74746.dat')]);
    expect(track.lines).toHaveLength(20);
    expect(openEnds(track)).toBe(0);
    const lap = 16 * CURVE + 4 * 320;
    // Walking a lap comes back to where it started.
    const back = track.walk(0, 100, lap);
    expect(back.line).toBe(0);
    expect(back.s).toBeCloseTo(100, 3);
    expect(back.short).toBe(0);
  });

  it('stops at a buffer, short by the distance it could not go', () => {
    const track = laidOut(['74746.dat', '74746.dat']);
    const end = track.walk(0, 0, 1000);
    expect(end.short).toBeCloseTo(1000 - 640, 3);
  });

  it("takes a switch's branch or its straight way as its state says, and changes when it flips", () => {
    // An oval with a switch on one side, and a straight left over as a siding on its branch.
    const track = laidOut([...new Array(16).fill('74747.dat'), '75542-f1.dat', ...new Array(5).fill('74746.dat')]);
    expect(track.switches).toHaveLength(1);
    const sw = track.switches[0];
    // Into the switch from the track that meets its shared end.
    const outside = track.beyond(sw.lines[0], 0)!;
    expect(track.beyond(outside[0], outside[1])![0]).toBe(sw.lines[0]);
    track.flip(sw.part);
    expect(track.beyond(outside[0], outside[1])![0]).toBe(sw.lines[1]);
    // The branch leads to the siding, which ends at a buffer: only its end is open, and the
    // switch's straight way's far end is joined.
    expect(openEnds(track)).toBe(1);
    expect(track.beyond(sw.lines[1], 1)).not.toBeNull();
  });

  it('keeps a wheelset on its line through a crossing, and on the line its switch picks', () => {
    // An oval with a crossing on one side: its other line meets nothing.
    const track = laidOut([...new Array(16).fill('74747.dat'), '32087.dat', ...new Array(3).fill('74746.dat')]);
    expect(openEnds(track)).toBe(2);
    const crossing = track.lines.findIndex((l) => track.lines.filter((m) => m.part === l.part).length === 2);
    // A wheelset going along the crossing's first line, past its middle, where the other line
    // crosses it, stays on its own.
    const frame = new Matrix4();
    for (let s = 20; s <= 300; s += 20) {
      const p = track.pointAt(crossing, s).point;
      const near = track.near(p, frame, 1)!;
      expect(track.placeOf(1)!.line).toBe(crossing);
      expect(Math.abs(near.offset)).toBeLessThan(1e-6);
    }
    // Past its end, on to the next piece.
    const next = track.beyond(crossing, 1)![0];
    const p = track.pointAt(next, 30).point;
    track.near(p, frame, 1);
    expect(track.placeOf(1)!.line).toBe(next);
    expect(lineAfter(track, crossing, 400)).toBe(next);
  });

  it('gives each piece its centre line at the rail heads: a curve is a sixteenth of a circle of 40 studs', () => {
    const track = buildTrack([{ name: '74747.dat', matrix: new Matrix4() }])!;
    expect(track.lines[0].length).toBeCloseTo(CURVE, 3);
    const mid = track.pointAt(0, CURVE / 2).point;
    expect(mid.distanceTo(new Vector3(0, -16, 0))).toBeLessThan(1e-6);
  });
});
