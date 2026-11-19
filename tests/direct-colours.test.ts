// A direct colour (the 8110 Unimog's axle p1365, written 44278436 in its file) is written back in
// the hex form three's LDrawLoader reads (see colourCode): else the part's conditional edges get
// no material, and the viewer throws on every frame that sees them.
import { Matrix4 } from 'three';
import { describe, expect, it } from 'vitest';
import { colourCode, parseLdr, partLine } from '../src/ldr.ts';

describe('direct colours', () => {
  it('are written in hex, other colours in decimal', () => {
    expect(colourCode(44278436)).toBe('0x2A3A2A4');
    expect(colourCode(0x2000000)).toBe('0x2000000');
    expect(colourCode(16)).toBe('16');
    expect(colourCode(72)).toBe('72');
  });
  it('read back from a written line as the same colour', () => {
    const [axle] = parseLdr('1 44278436 18.477 -40 7.653 0.924 0 -0.383 0 1 0 0.383 0 0.924 4519.dat');
    const line = partLine(axle);
    expect(line.startsWith('1 0x2A3A2A4 ')).toBe(true);
    expect(parseLdr(line)[0]).toMatchObject({ name: '4519.dat', color: 44278436 });
    expect(partLine({ name: '3001.dat', color: 4, matrix: new Matrix4() }).startsWith('1 4 ')).toBe(true);
  });
});
