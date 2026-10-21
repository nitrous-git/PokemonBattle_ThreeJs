import { pathToFileURL } from 'node:url';
import { read, write } from './io.mjs';
import { validateContent } from '../src/domain/validation.js';
export const TYPES = [
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
];
const statMap = {
  hp: 'hp',
  attack: 'attack',
  defense: 'defense',
  'special-attack': 'spAttack',
  'special-defense': 'spDefense',
  speed: 'speed',
};
export function normalizePokemon(raw, expected) {
  if (raw.id !== expected.dexNumber || raw.name !== expected.id)
    throw Error(`Source identity mismatch ${expected.id}`);
  const stats = {};
  for (const entry of raw.stats) {
    const key = statMap[entry.stat.name];
    if (!key || stats[key] || !Number.isInteger(entry.base_stat) || entry.base_stat <= 0)
      throw Error('Invalid source stats');
    stats[key] = entry.base_stat;
  }
  if (Object.keys(stats).length !== 6) throw Error('Missing source stats');
  const types = [...raw.types].sort((a, b) => a.slot - b.slot).map((x) => x.type.name);
  if (!types.length || types.length > 2 || types.some((t) => !TYPES.includes(t)))
    throw Error('Invalid source types');
  return {
    id: raw.name,
    dexNumber: raw.id,
    displayName: raw.name[0].toUpperCase() + raw.name.slice(1),
    baseStats: stats,
    types,
  };
}
export async function compile(snapshot, { validateOnly = false } = {}) {
  const [speciesConfig, pools, moveConfig] = await Promise.all(
    ['speciesOverrides', 'movePools', 'moveOverrides'].map((n) => read(`src/data/game/${n}.json`)),
  );
  const pokemon = {},
    moves = {},
    audit = [],
    diffs = [];
  for (const [id, cfg] of Object.entries(speciesConfig)) {
    const raw = snapshot.pokemon[id];
    if (!raw) throw Error(`Missing source ${id}`);
    pokemon[id] = { ...normalizePokemon(raw, { id, ...cfg }), ...cfg, legalMoves: pools[id] };
    for (const moveId of pools[id]) {
      const found = raw.moves.find((x) => x.move.name === moveId);
      const versions = [
        ...new Set((found?.version_group_details || []).map((v) => v.version_group.name)),
      ];
      const reason = cfg.customMoves[moveId];
      if (!versions.length && !reason) throw Error(`Unreviewed custom allowance: ${id}/${moveId}`);
      audit.push({
        speciesId: id,
        moveId,
        observedVersionGroups: versions,
        supportedInSomeVersion: !!versions.length,
        customExceptionReason: reason || null,
      });
    }
  }
  for (const [id, cfg] of Object.entries(moveConfig)) {
    const raw = snapshot.moves[id];
    if (!raw || raw.name !== id || !Number.isInteger(raw.id))
      throw Error(`Invalid source move ${id}`);
    const expected = snapshot.provenance.resources.find((r) => r.kind === 'move' && r.name === id);
    if (
      !expected ||
      expected.id !== raw.id ||
      !TYPES.includes(raw.type?.name) ||
      !['physical', 'special', 'status'].includes(raw.damage_class?.name) ||
      !Number.isInteger(raw.pp) ||
      raw.pp <= 0 ||
      !Number.isInteger(raw.priority) ||
      !(
        raw.accuracy === null ||
        (Number.isFinite(raw.accuracy) && raw.accuracy > 0 && raw.accuracy <= 100)
      ) ||
      !(raw.power === null || (Number.isFinite(raw.power) && raw.power > 0))
    )
      throw Error(`Invalid source move metadata ${id}`);
    const facts = {
      power: raw.power,
      accuracy: raw.accuracy,
      maxPP: raw.pp,
      type: raw.type.name,
      category: raw.damage_class.name,
      priority: raw.priority,
    };
    for (const [key, value] of Object.entries(facts))
      if (cfg[key] !== value)
        diffs.push({
          id,
          key,
          sourceValue: value,
          effectiveValue: cfg[key],
          reason: cfg.overrideReason,
        });
    moves[id] = { id, sourceId: raw.id, ...cfg };
  }
  const typeChart = {};
  for (const a of TYPES) {
    const raw = snapshot.types[a];
    if (!raw || raw.name !== a) throw Error(`Missing type ${a}`);
    typeChart[a] = Object.fromEntries(TYPES.map((b) => [b, 1]));
    for (const [key, mult] of [
      ['double_damage_to', 2],
      ['half_damage_to', 0.5],
      ['no_damage_to', 0],
    ])
      for (const t of raw.damage_relations[key])
        if (TYPES.includes(t.name)) typeChart[a][t.name] = mult;
  }
  validateContent({ pokemon, moves, typeChart });
  if (!validateOnly) {
    for (const [name, data] of Object.entries({
      pokemon,
      moves,
      typeChart,
      learnsetAudit: audit,
      overrideAudit: diffs,
      importManifest: snapshot.provenance,
    }))
      await write(`src/data/generated/${name}.json`, data);
    console.log(
      `Compiled ${Object.keys(pokemon).length} species, ${Object.keys(moves).length} moves, 18×18 types. ${audit.filter((x) => !x.supportedInSomeVersion).length} explicit custom allowances.`,
    );
  }
  return { pokemon, moves, typeChart };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await compile(await read('src/data/source/snapshot.json'));
