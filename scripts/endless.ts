import { readFileSync } from 'node:fs';

// The kinds of mechanism whose real part turns without end (decision 252 of 2026-11-20): a wheel
// that rolls, a track that runs, an engine's crankshaft, a drive shaft. A collision that stops such
// a part is a fault, however far the part turned first; a part with an end (a lever, a door) may
// stop at it. The viewer sweep's judge and the function check (decision 279) both go by these.
export const ENDLESS = new Set(['belt-drive', 'chain-drive', 'conveyor', 'crawler-tracks', 'differential', 'driven-detail', 'driven-rotor', 'free-wheels', 'piston-engine', 'planetary-hub', 'portal-axle', 'power-take-off', 'pull-back-motor', 'rotary-tool', 'valve-train']);

// Words in a function's text that say the same, shown beside the kinds.
export const ENDLESS_WORDS = /\b(rolls?|rolling|spins?|spinning|rotors?|fans?|engine|pistons?|tracks?|power take-off|turns? freely|runs? freely|drive shaft|propellers?|wheels?)\b/gi;

// A function's kinds (its `mechanisms`, each a kind with an optional note after a colon, as
// "piston-engine: V8") that turn without end, and whether all of them do: a function whose kinds
// all turn without end turns without end.
export function endlessKinds(mechanisms: string[] | undefined): { kinds: string[]; endless: boolean } {
  const all = (mechanisms ?? []).map((m) => m.split(':')[0].trim());
  const kinds = all.filter((k) => ENDLESS.has(k));
  return { kinds, endless: kinds.length > 0 && kinds.length === all.length };
}

// Whether a part is itself one that turns without end (decision 282 of 2026-11-21): a wheel, a
// rim or tyre, a gear or sprocket, a pulley, a propeller or rotor, a shaft (an axle), a worm, a
// crankshaft, a differential, by its role (data/roles.json) or by its LDraw title. A collision stop
// is judged only where the control it stopped is such a part, never by the function's kinds
// alone: the 8063's lever (a connector on the catch's axle) stops at the end of its real travel.
// Not a steering wheel, a hub, a spindle, a joiner, a connector or a towball: those turn so far.
// The title words are a stopgap (decision 284 of 2026-11-21): data/roles.json holds few of these
// parts yet (most rims have none), and as the roles are filled in they take over, a part's role
// deciding wherever it has one.
const ENDLESS_ROLES = new Set(['tyre', 'rim', 'gear', 'axle', 'differential', 'crankshaft', 'worm', 'train wheel']);
const ENDLESS_TITLE = /\b(wheel|rim|tyre|tire|gear|sprocket|pulley|propeller|rotor|axle|worm|crankshaft|differential)\b/i;
// Nor a block, beam, liftarm or other part that only has an axle hole, named "(Axle/Pin)" and the
// like in its title: the 42003 Cross Block 1 x 3 (Axle/Pin/Pin) is no shaft.
const NOT_ENDLESS_TITLE = /\b(steering|hub|spindle|joiner|connector|towball|block|beam|liftarm|brick|plate)\b|\(axle/i;
let roles: Record<string, string> | null = null;
let titles: Record<string, string> | null = null;
export function endlessPart(name: string): boolean {
  const file = name.endsWith('.dat') ? name : `${name}.dat`;
  roles ??= JSON.parse(readFileSync('data/roles.json', 'utf-8')) as Record<string, string>;
  const role = roles[file] ?? roles[file.replace(/\.dat$/, '')];
  if (role) return ENDLESS_ROLES.has(role);
  titles ??= JSON.parse(readFileSync('packed/titles.json', 'utf-8')) as Record<string, string>;
  let title = titles[file];
  if (title === undefined) {
    for (const dir of ['ldraw/parts', 'ldraw/unofficial/parts']) {
      try {
        title = readFileSync(`${dir}/${file.replace(/^.* - /, '')}`, 'utf-8').split('\n')[0].replace(/^0\s+~?/, '');
        break;
      } catch {}
    }
  }
  return !!title && ENDLESS_TITLE.test(title) && !NOT_ENDLESS_TITLE.test(title);
}
