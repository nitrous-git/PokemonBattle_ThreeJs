// Authoring only. Fetch into memory; replace the single snapshot only after all resources validate.
import { read, write, download, parallel, hash } from './io.mjs';
import { compile } from './compile-content.mjs';
const lock = await read('src/data/game/source-lock.json');
const species = await read('src/data/game/speciesOverrides.json');
const overrides = await read('src/data/game/moveOverrides.json');
const base = process.argv.includes('--live')
  ? 'https://pokeapi.co/api/v2/'
  : `https://raw.githubusercontent.com/PokeAPI/api-data/${lock.apiDataRevision}/data/api/v2/`;
const url = (kind, id) =>
  `${base}${kind}/${id}/${base.includes('raw.githubusercontent') ? 'index.json' : ''}`;
const get = async (kind, id) => JSON.parse(await download(url(kind, id)));
try {
  // Reuse only hash-verified records from the identical pin; additions still fetch upstream.
  const prior = process.argv.includes('--missing')
    ? await read('src/data/source/snapshot.json')
    : null;
  if (
    prior &&
    (prior.provenance.apiDataRevision !== lock.apiDataRevision || prior.provenance.baseURL !== base)
  )
    throw Error('--missing requires the existing snapshot to use the same pinned source');
  const moveIndex = JSON.parse(
    await download(
      `${base}move/${base.includes('raw.githubusercontent') ? 'index.json' : '?limit=2000'}`,
    ),
  );
  const ids = Object.fromEntries(
    moveIndex.results.map((m) => [m.name, Number(m.url.split('/').filter(Boolean).at(-1))]),
  );
  const snapshot = {
    pokemon: {},
    moves: {},
    types: {},
    provenance: {
      ...lock,
      baseURL: base,
      fetchedAtUTC: new Date().toISOString(),
      sourceSchemaVersion: 1,
      resources: [],
    },
  };
  const jobs = [
    ...Object.entries(species).map(([name, s]) => ['pokemon', s.dexNumber, name]),
    ...Object.keys(overrides).map((n) => ['move', ids[n], n]),
    ...[
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
    ].map((n) => [
      'type',
      {
        normal: 1,
        fighting: 2,
        flying: 3,
        poison: 4,
        ground: 5,
        rock: 6,
        bug: 7,
        ghost: 8,
        steel: 9,
        fire: 10,
        water: 11,
        grass: 12,
        electric: 13,
        psychic: 14,
        ice: 15,
        dragon: 16,
        dark: 17,
        fairy: 18,
      }[n],
      n,
    ]),
  ];
  await parallel(jobs, async ([kind, id, name]) => {
    if (!id) throw new Error(`Unknown source ID ${name}`);
    const bucket = kind === 'move' ? 'moves' : kind === 'type' ? 'types' : 'pokemon';
    const cached = prior?.[bucket]?.[name];
    const record = prior?.provenance.resources.find((r) => r.kind === kind && r.name === name);
    if (
      cached &&
      (!record ||
        record.id !== id ||
        record.url !== url(kind, id) ||
        record.sha256 !== hash(cached))
    )
      throw Error(`Cached source integrity mismatch: ${name}`);
    const data = cached || (await get(kind, id));
    if (data.id !== id || data.name !== name) throw new Error(`Source identity mismatch: ${name}`);
    snapshot[kind === 'move' ? 'moves' : kind === 'type' ? 'types' : 'pokemon'][name] = data;
    snapshot.provenance.resources.push({ kind, id, name, url: url(kind, id), sha256: hash(data) });
  });
  for (const key of ['pokemon', 'moves', 'types'])
    snapshot[key] = Object.fromEntries(
      Object.entries(snapshot[key]).sort(([a], [b]) => a.localeCompare(b)),
    );
  snapshot.provenance.resources.sort((a, b) => (a.kind + a.name).localeCompare(b.kind + b.name));
  snapshot.provenance.sourceHash = hash([snapshot.pokemon, snapshot.moves, snapshot.types]);
  // First imports can explicitly print missing curated exceptions for review, never auto-approve them.
  const compiled = await compile(snapshot, { validateOnly: true });
  let priorChart;
  try {
    priorChart = await read('src/data/generated/typeChart.json');
  } catch {}
  if (priorChart && hash(priorChart) !== hash(compiled.typeChart))
    throw Error(
      'Type-chart change requires explicit review of the frozen ruleset; previous snapshot preserved.',
    );
  await write('src/data/source/snapshot.json', snapshot);
  console.log(`Imported ${jobs.length} resources; prior snapshot replaced atomically.`);
} catch (e) {
  console.error(`Import failed; previous snapshot retained. ${e.message}`);
  process.exitCode = 1;
}
