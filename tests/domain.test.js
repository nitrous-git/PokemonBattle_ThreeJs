import { describe, it, expect } from 'vitest';
import { pokemon, moves, typeChart } from '../src/data/catalogue.js';
import { RNG } from '../src/domain/random.js';
import {
  damage,
  draftMoves,
  effectiveness,
  stats,
  legalMoves,
  effectiveStat,
} from '../src/domain/rules.js';
import { resolveTurn, createBattle } from '../src/domain/battle.js';
import { chooseAI } from '../src/domain/ai.js';
import { newSave, purchase, applyReward, validateSave } from '../src/domain/progression.js';
import { SaveService } from '../src/services/SaveService.js';
import { normalizePokemon, compile } from '../scripts/compile-content.mjs';
import { read } from '../scripts/io.mjs';
const identity = (seed = 42) => ({ seed, instanceId: `owned-${seed}`, acquiredAt: '2026-10-20' });
const instance = newSave('pikachu', identity()).collection[0];
function battle(p = 'pikachu', o = 'squirtle', seed = 42) {
  const b = createBattle({
    instance: { ...instance, speciesId: p, moveIds: draftMoves(p, new RNG(seed)) },
    opponentId: o,
    seed,
    battleId: `battle-${seed}`,
  });
  return b;
}
function setMoves(a, ids) {
  a.moves = ids.map((id) => ({ id, pp: moves[id].maxPP, maxPP: moves[id].maxPP }));
}
function neutral(b) {
  setMoves(b.player, ['harden']);
  setMoves(b.opponent, ['harden']);
  return b;
}
describe('content and source', () => {
  it('compiles source deterministically and catches identities/learnsets', async () => {
    const raw = await read('src/data/source/snapshot.json');
    const a = await compile(raw, { validateOnly: true });
    expect(await compile(raw, { validateOnly: true })).toEqual(a);
    const broken = structuredClone(raw);
    broken.pokemon.pikachu.id = 7;
    await expect(compile(broken, { validateOnly: true })).rejects.toThrow('identity');
    const absent = structuredClone(raw);
    absent.pokemon.squirtle.moves = [];
    await expect(compile(absent, { validateOnly: true })).rejects.toThrow('allowance');
    const badMove = structuredClone(raw);
    badMove.moves.tackle.id = 999999;
    await expect(compile(badMove, { validateOnly: true })).rejects.toThrow('source move');
    badMove.moves.tackle.id = raw.moves.tackle.id;
    badMove.moves.tackle.pp = -1;
    await expect(compile(badMove, { validateOnly: true })).rejects.toThrow('source move');
    badMove.moves.tackle.name = 'oops';
    await expect(compile(badMove, { validateOnly: true })).rejects.toThrow('source move');
  });
  it('requires all six source stats', () =>
    expect(() =>
      normalizePokemon(
        { id: 25, name: 'pikachu', stats: [], types: [] },
        { id: 'pikachu', dexNumber: 25 },
      ),
    ).toThrow());
  it('contains the exact roster and catalogue', () => {
    expect(Object.keys(pokemon)).toHaveLength(24);
    expect(Object.keys(moves)).toHaveLength(66);
    expect(Object.values(typeChart).flatMap(Object.values)).toHaveLength(324);
  });
  it('preserves zero and compound type relationships', () => {
    expect(effectiveness('electric', ['ground'])).toBe(0);
    expect(effectiveness('normal', ['rock', 'ghost'])).toBe(0);
    expect(effectiveness('electric', ['water'])).toBe(2);
    expect(effectiveness('fire', ['grass'])).toBe(2);
    expect(effectiveness('ice', ['dragon', 'flying'])).toBe(4);
    expect(() => effectiveness('water', ['unknown'])).toThrow();
  });
  it('drafts four stable, distinct, useful moves for every species across seeds', () => {
    for (const s of Object.values(pokemon))
      for (let seed = 0; seed < 100; seed++) {
        const list = draftMoves(s.id, new RNG(seed));
        expect(new Set(list).size).toBe(4);
        expect(list).toEqual(draftMoves(s.id, new RNG(seed)));
        expect(list.every((m) => s.legalMoves.includes(m))).toBe(true);
        expect(list.filter((m) => moves[m].power > 0).length).toBeGreaterThanOrEqual(2);
        expect(list.some((m) => moves[m].power > 0 && s.types.includes(moves[m].type))).toBe(true);
      }
  });
});
describe('battle rules', () => {
  it('calculates level-dependent stats and burn physical penalty', () => {
    expect(stats('pikachu', 5).hp).toBe(19);
    const b = battle();
    expect(effectiveStat(b.player, 'attack')).toBe(11);
    b.player.status = 'burn';
    expect(effectiveStat(b.player, 'attack')).toBe(5.5);
  });
  it('never damages immune targets or inflicts secondary paralysis', () => {
    const b = battle('pikachu', 'sandshrew');
    setMoves(b.player, ['thunderbolt']);
    setMoves(b.opponent, ['harden']);
    const r = resolveTurn(b, 0, 0);
    expect(r.state.opponent.hp).toBe(b.opponent.hp);
    expect(r.state.opponent.status).toBe(null);
    expect(r.events.some((e) => e.type === 'IMMUNE')).toBe(true);
    expect(r.state.player.moves[0].pp).toBe(14);
  });
  it('critical ignores adverse attacker and beneficial defender stages', () => {
    const b = battle();
    b.player.stages.attack = -6;
    b.opponent.stages.defense = 6;
    expect(damage(b.player, b.opponent, moves.tackle, { critical: true })).toBeGreaterThan(
      damage(b.player, b.opponent, moves.tackle),
    );
  });
  it('spends PP on blocked sleep attempts and wakes on the next action', () => {
    let b = neutral(battle());
    b.player.status = 'sleep';
    b.player.statusTurns = 2;
    for (let i = 0; i < 2; i++) {
      const r = resolveTurn(b, 0, 0);
      expect(r.events.some((e) => e.actor === 'player' && e.type === 'BLOCKED')).toBe(true);
      b = r.state;
    }
    const r = resolveTurn(b, 0, 0);
    expect(r.state.player.status).toBe(null);
    expect(r.state.player.moves[0].pp).toBe(27);
    expect(r.events.some((e) => e.actor === 'player' && e.type === 'MOVE')).toBe(true);
  });
  it('handles thaw, paralysis, confusion and their probabilities over seeds', () => {
    let thaw = 0,
      par = 0,
      self = 0;
    for (let seed = 1; seed <= 200; seed++) {
      for (const status of ['freeze', 'paralysis', 'confusion']) {
        const b = neutral(battle('pikachu', 'squirtle', seed));
        b.rngState = seed;
        if (status === 'confusion') b.player.confusion = 3;
        else b.player.status = status;
        const r = resolveTurn(b, 0, 0);
        if (status === 'freeze' && r.state.player.status === null) {
          thaw++;
          expect(r.events.some((e) => e.actor === 'player' && e.type === 'MOVE')).toBe(true);
        }
        if (
          status === 'paralysis' &&
          r.events.some((e) => e.actor === 'player' && e.type === 'BLOCKED')
        )
          par++;
        if (status === 'confusion' && r.state.player.hp < b.player.hp) self++;
      }
    }
    expect(thaw).toBeGreaterThan(20);
    expect(thaw).toBeLessThan(70);
    expect(par).toBeGreaterThan(25);
    expect(par).toBeLessThan(80);
    expect(self).toBeGreaterThan(40);
    expect(self).toBeLessThan(95);
  });
  it('checks immunity for statuses but lets neutral debuffs affect Ghost', () => {
    const b = battle('pikachu', 'gastly');
    setMoves(b.player, ['growl']);
    setMoves(b.opponent, ['harden']);
    expect(resolveTurn(b, 0, 0).state.opponent.stages.attack).toBe(-1);
    const c = battle('pikachu', 'sandshrew');
    setMoves(c.player, ['thunder-wave']);
    setMoves(c.opponent, ['harden']);
    expect(resolveTurn(c, 0, 0).state.opponent.status).toBe(null);
  });
  it('resolves priority before speed and prevents action after KO', () => {
    const b = battle('squirtle', 'pikachu');
    setMoves(b.player, ['quick-attack']);
    setMoves(b.opponent, ['thunderbolt']);
    b.opponent.hp = 1;
    const r = resolveTurn(b, 0, 0);
    expect(r.events.find((e) => e.type === 'MOVE').actor).toBe('player');
    expect(r.events.filter((e) => e.type === 'MOVE')).toHaveLength(1);
    expect(r.result.outcome).toBe('player');
    expect(() => resolveTurn(r.state, 0, 0)).toThrow();
  });
  it('produces double residual KO and a draw', () => {
    const b = neutral(battle());
    for (const side of ['player', 'opponent']) {
      b[side].hp = 1;
      b[side].status = 'poison';
    }
    const r = resolveTurn(b, 0, 0);
    expect(r.result.outcome).toBe('draw');
    expect(r.result.coins).toBe(10);
    expect(r.result.xp).toBe(0);
  });
  it('rejects exhausted moves and offers recoil Struggle', () => {
    const b = battle();
    for (const m of b.player.moves) m.pp = 0;
    expect(legalMoves(b.player)).toEqual([-1]);
    expect(() => resolveTurn(b, 0, 0)).toThrow('Illegal');
    b.player.hp = 1;
    b.opponent.hp = 1;
    setMoves(b.opponent, ['harden']);
    const r = resolveTurn(b, -1, 0);
    expect(r.state.player.hp).toBe(0);
    expect(r.result.outcome).toBe('draw');
  });
  it('clamps stat stages and reports failed boosts', () => {
    const b = neutral(battle());
    b.player.stages.defense = 6;
    const r = resolveTurn(b, 0, 0);
    expect(r.state.player.stages.defense).toBe(6);
    expect(r.events.some((e) => e.type === 'FAILED' && e.actor === 'player')).toBe(true);
  });
  it('is deterministic and does not mutate input', () => {
    const b = battle(),
      copy = structuredClone(b);
    expect(resolveTurn(b, 0, 0)).toEqual(resolveTurn(b, 0, 0));
    expect(b).toEqual(copy);
  });
  it('encounters misses and criticals', () => {
    let miss = false,
      crit = false;
    for (let seed = 0; seed < 100; seed++) {
      const b = battle('squirtle', 'pikachu', seed);
      b.rngState = seed;
      setMoves(b.player, ['hydro-pump']);
      setMoves(b.opponent, ['harden']);
      const r = resolveTurn(b, 0, 0);
      miss ||= r.events.some((e) => e.type === 'MISS');
      crit ||= r.events.some((e) => e.critical);
    }
    expect(miss && crit).toBe(true);
  });
});
describe('AI and lifecycle', () => {
  it('Hard chooses coverage over an immune attack', () => {
    const b = battle('sandshrew', 'pikachu');
    setMoves(b.opponent, ['thunderbolt', 'swift']);
    expect(chooseAI(b, 'hard')).toBe(1);
  });
  it('finishes 60 seeded matches with legal actions and finite state', () => {
    for (let seed = 0; seed < 60; seed++) {
      let b = battle(Object.keys(pokemon)[seed % Object.keys(pokemon).length], Object.keys(pokemon)[(seed + 3) % Object.keys(pokemon).length], seed);
      let count = 0;
      while (b.phase !== 'ended' && count++ < 180) {
        const enemy = chooseAI(b, count % 4 === 0 ? 'hard' : 'normal');
        expect(legalMoves(b.opponent)).toContain(enemy);
        const mirrored = { ...b, player: b.opponent, opponent: b.player };
        const p = chooseAI(mirrored, 'normal');
        b = resolveTurn(b, p, enemy).state;
      }
      expect(b.phase).toBe('ended');
      expect(Number.isFinite(b.player.hp)).toBe(true);
    }
  });
});
describe('save and economy', () => {
  it('atomically purchases and refuses insufficient/duplicate transactions', () => {
    let s = newSave('pikachu', identity());
    const copy = structuredClone(s);
    expect(() => purchase(s, 'bulbasaur', identity(43))).toThrow('coins');
    expect(s).toEqual(copy);
    s.trainer.coins = 600;
    const p = purchase(s, 'bulbasaur', identity(43));
    expect(p.trainer.coins).toBe(300);
    expect(p.collection).toHaveLength(2);
    expect(() => purchase(p, 'bulbasaur', identity(44))).toThrow('Already');
  });
  it('applies XP/coins exactly once, survives serialization, clears battle status', () => {
    const s = newSave('pikachu', identity()),
      r = { battleId: 'one', instanceId: instance.instanceId, coins: 70, xp: 120 };
    const p = applyReward(s, r);
    expect(p.trainer.coins).toBe(270);
    expect(p.collection[0].level).toBe(6);
    expect(applyReward(p, r)).toBe(p);
    expect(validateSave(JSON.parse(JSON.stringify(p)))).toEqual(p);
    const b = createBattle({
      instance: p.collection[0],
      opponentId: 'squirtle',
      seed: 2,
      battleId: 'next',
    });
    expect(b.player.status).toBe(null);
    expect(b.player.hp).toBe(b.player.maxHP);
  });
  it('handles migrations and rejects corruption without random reassignment', () => {
    const s = newSave('pikachu', identity());
    s.saveVersion = 0;
    expect(validateSave(s).saveVersion).toBe(1);
    s.trainer.coins = -1;
    expect(() => validateSave(s)).toThrow();
    s.trainer.coins = 200;
    s.collection[0].moveIds[0] = 'missing';
    expect(() => validateSave(s)).toThrow('preserved');
  });
  it('keeps current state unchanged when storage fails and catches stale tabs', () => {
    let raw = null;
    const storage = {
      getItem: () => raw,
      setItem: (_, v) => {
        raw = v;
      },
    };
    const service = new SaveService(storage);
    const s = service.commit(null, () => newSave('pikachu', identity()));
    expect(service.load()).toEqual(s);
    storage.setItem = () => {
      throw Error('quota');
    };
    expect(() =>
      service.commit(s, (x) => ({ ...x, trainer: { ...x.trainer, coins: 999 } })),
    ).toThrow('quota');
    expect(service.load().trainer.coins).toBe(200);
    storage.setItem = (_, v) => {
      raw = v;
    };
    service.commit(s, (x) => x);
    expect(() => service.commit(s, (x) => x)).toThrow('another tab');
  });
});
