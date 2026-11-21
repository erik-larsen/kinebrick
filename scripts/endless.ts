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
