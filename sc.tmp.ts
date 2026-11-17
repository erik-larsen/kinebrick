import { loadModel } from './scripts/load-model.ts';
const l = loadModel('omr/42129-1 4x4 Mercedes-Benz Zetros Trial Truck.mpd', true); const m = l.mech as any;
const P = (i: number) => 'p' + i + ' ' + l.parts[i].name.replace('.dat', '').replace(/^.* - /, '');
for (const c of m.connections) if ([546, 547, 737, 738].includes(c.male) || [546, 547, 737, 738].includes(c.female)) console.log(P(c.male), 'b' + m.bodyOf[c.male], '->', P(c.female), 'b' + m.bodyOf[c.female], c.kind);
