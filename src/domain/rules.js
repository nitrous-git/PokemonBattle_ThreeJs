import { pokemon, moves, typeChart } from '../data/catalogue.js';
export const stageMultiplier = (n) => (n >= 0 ? (2 + n) / 2 : 2 / (2 - n));
export const accuracyMultiplier = (n) => (n >= 0 ? (3 + n) / 3 : 3 / (3 - n));
export function stats(speciesId, level) {
  return Object.fromEntries(
    Object.entries(pokemon[speciesId].baseStats).map(([k, v]) => [
      k,
      Math.floor(((2 * v + 15) * level) / 100) + (k === 'hp' ? level + 10 : 5),
    ]),
  );
}
export function effectiveness(type, defenders) {
  if (type === 'typeless') return 1;
  if (
    !typeChart[type] ||
    !defenders.length ||
    defenders.some((t) => typeChart[type][t] === undefined)
  )
    throw Error('Unknown type');
  return defenders.reduce((v, t) => v * typeChart[type][t], 1);
}
export function effectiveStat(actor, key, crit = false, defending = false) {
  let stage = actor.stages[key] || 0;
  if (crit) stage = defending ? Math.min(0, stage) : Math.max(0, stage);
  let value = actor.stats[key] * stageMultiplier(stage);
  if (key === 'speed' && actor.status === 'paralysis') value *= 0.5;
  if (key === 'attack' && actor.status === 'burn') value *= 0.5;
  return Math.max(1, value);
}
export function damage(
  attacker,
  defender,
  move,
  { critical = false, variance = 1, typeless = false } = {},
) {
  const mult = typeless ? 1 : effectiveness(move.type, defender.types);
  if (!mult) return 0;
  const physical = move.category === 'physical';
  const atk = effectiveStat(attacker, physical ? 'attack' : 'spAttack', critical);
  const def = effectiveStat(defender, physical ? 'defense' : 'spDefense', critical, true);
  const base =
    Math.floor(Math.floor((((2 * attacker.level) / 5 + 2) * move.power * atk) / def) / 50) + 2;
  return Math.max(
    1,
    Math.floor(
      base *
        (typeless ? 1 : attacker.types.includes(move.type) ? 1.5 : 1) *
        mult *
        (critical ? 1.5 : 1) *
        variance,
    ),
  );
}
export function draftMoves(speciesId, rng) {
  const s = pokemon[speciesId],
    pool = rng.shuffle(s.legalMoves);
  const stab = pool.find((id) => moves[id].power > 0 && s.types.includes(moves[id].type));
  const other = pool.find((id) => id !== stab && moves[id].power > 0);
  if (!stab || !other) throw Error('Unusable move pool');
  const result = [stab, other];
  for (const id of pool) if (!result.includes(id) && result.length < 4) result.push(id);
  return rng.shuffle(result);
}
export const STRUGGLE = {
  id: 'struggle',
  name: 'Struggle',
  type: 'typeless',
  category: 'physical',
  power: 50,
  accuracy: null,
  alwaysHit: true,
  priority: 0,
  target: 'opponent',
  effects: [{ kind: 'DAMAGE' }, { kind: 'RECOIL', recoilFraction: 0.25 }],
  vfxPreset: 'normal',
  description: 'Last resort. Recoil: ¼ damage dealt.',
};
export function legalMoves(actor) {
  const indexes = actor.moves.flatMap((m, i) => (m.pp > 0 ? [i] : []));
  return indexes.length ? indexes : [-1];
}
export const getMove = (actor, slot) => (slot === -1 ? STRUGGLE : moves[actor.moves[slot].id]);
export const mayApplyStatus = (actor, status) =>
  !actor.status &&
  !(
    { burn: ['fire'], freeze: ['ice'], poison: ['poison', 'steel'], paralysis: ['electric'] }[
      status
    ] || []
  ).some((t) => actor.types.includes(t));
