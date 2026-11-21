import { readParts } from '../load-model.ts';
import { readFileSync } from 'node:fs';
const [file, ...ids] = process.argv.slice(2);
const parts: any = readParts(file, file.startsWith('omr/'));
const list = Array.isArray(parts) ? parts : parts.parts;
for (const id of ids) { const p = list[+id]; const n = (p.name ?? p.file); let t = ''; try { t = readFileSync(`ldraw/parts/${n}`, 'utf8').split('\n')[0]; } catch {} console.log(id, n, t, p.matrix ? [p.matrix[12] ?? p.matrix.elements?.[12]] : ''); }
