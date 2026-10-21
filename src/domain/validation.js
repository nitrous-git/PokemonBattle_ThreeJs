const assert = (condition, message) => {
  if (!condition) throw Error(message);
};
export function validateContent({ pokemon, moves, typeChart }) {
  const types = Object.keys(typeChart);
  assert(types.length === 18, 'Type chart needs 18 types');
  for (const a of types) {
    assert(Object.keys(typeChart[a]).length === 18, 'Incomplete type row');
    for (const b of types)
      assert([0, 0.5, 1, 2].includes(typeChart[a][b]), `Invalid type cell ${a}/${b}`);
  }
  assert(Object.keys(pokemon).length === 16, 'Expected 16 species');
  assert(Object.keys(moves).length === 61, 'Expected 61 moves');
  assert(new Set(Object.values(pokemon).map((s) => s.dexNumber)).size === 16, 'Duplicate dex ID');
  assert(
    new Set(Object.values(moves).map((m) => m.sourceId)).size === 61,
    'Duplicate source move ID',
  );
  for (const [id, s] of Object.entries(pokemon)) {
    assert(
      s.id === id &&
        s.types.length > 0 &&
        s.types.length < 3 &&
        s.types.every((t) => types.includes(t)),
      `Invalid species ${id}`,
    );
    assert(
      Object.keys(s.baseStats).length === 6 &&
        Object.values(s.baseStats).every((v) => Number.isInteger(v) && v > 0),
      'Invalid stats',
    );
    assert(Number.isInteger(s.priceCoins) && s.priceCoins >= 0, 'Invalid price');
    assert(
      s.legalMoves.length >= 4 &&
        new Set(s.legalMoves).size === s.legalMoves.length &&
        s.legalMoves.every((m) => moves[m]),
      `Invalid pool ${id}`,
    );
    assert(
      s.legalMoves.filter((m) => moves[m].category !== 'status').length >= 2,
      'Need two attacks',
    );
    assert(
      s.legalMoves.some((m) => s.types.includes(moves[m].type) && moves[m].power > 0),
      'Need STAB',
    );
  }
  for (const [id, m] of Object.entries(moves)) {
    assert(m.id === id && types.includes(m.type), 'Invalid move identity/type');
    assert(['physical', 'special', 'status'].includes(m.category), 'Invalid category');
    assert(Number.isInteger(m.maxPP) && m.maxPP > 0, 'Invalid PP');
    assert(Number.isInteger(m.priority), 'Invalid priority');
    assert(['self', 'opponent'].includes(m.target), 'Invalid target');
    assert(
      m.alwaysHit
        ? m.accuracy === null
        : Number.isFinite(m.accuracy) && m.accuracy > 0 && m.accuracy <= 100,
      'Invalid accuracy',
    );
    assert(
      m.category === 'status' ? m.power === null : Number.isFinite(m.power) && m.power > 0,
      'Invalid power',
    );
    assert(m.effects.length && m.vfxPreset && m.overrideReason, 'Missing effect/visual/review');
    for (const e of m.effects) {
      assert(
        ['DAMAGE', 'APPLY_MAJOR_STATUS', 'APPLY_CONFUSION', 'STAT_STAGE', 'RECOIL'].includes(
          e.kind,
        ),
        `Unsupported effect ${e.kind}`,
      );
      assert(e.chance === undefined || (e.chance >= 0 && e.chance <= 1), 'Invalid chance');
      if (e.kind === 'APPLY_MAJOR_STATUS')
        assert(
          ['burn', 'paralysis', 'sleep', 'freeze', 'poison'].includes(e.status),
          'Invalid status',
        );
      if (e.kind === 'STAT_STAGE')
        assert(
          ['attack', 'defense', 'spAttack', 'spDefense', 'speed', 'accuracy', 'evasion'].includes(
            e.stat,
          ) &&
            Number.isInteger(e.stages) &&
            e.stages !== 0 &&
            Math.abs(e.stages) <= 6,
          'Invalid stage',
        );
      if (e.kind === 'RECOIL')
        assert(e.recoilFraction > 0 && e.recoilFraction <= 1, 'Invalid recoil');
    }
  }
  return true;
}
