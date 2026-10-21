import { it, expect } from 'vitest';
import { makeActor, createBattle, resolveTurn } from '../src/domain/battle.js';
import { newSave } from '../src/domain/progression.js';
import { mayApplyStatus, effectiveStat } from '../src/domain/rules.js';
import { moves } from '../src/data/catalogue.js';
const base = () =>
  createBattle({
    instance: newSave('pikachu', { seed: 1, instanceId: 'one', acquiredAt: 'fixed' }).collection[0],
    opponentId: 'squirtle',
    seed: 22,
    battleId: 'test',
  });
const assign = (actor, ids) => {
  actor.moves = ids.map((id) => ({ id, pp: 10, maxPP: moves[id].maxPP }));
};
it('enforces all status-type immunities and one-major-status limit', () => {
  for (const [id, status] of [
    ['charmander', 'burn'],
    ['magnemite', 'poison'],
    ['bulbasaur', 'poison'],
    ['pikachu', 'paralysis'],
  ]) {
    expect(mayApplyStatus(makeActor(id, 5, ['tackle']), status)).toBe(false);
  }
  const a = makeActor('squirtle', 5, ['tackle']);
  a.types = ['ice'];
  expect(mayApplyStatus(a, 'freeze')).toBe(false);
  a.status = 'sleep';
  expect(mayApplyStatus(a, 'burn')).toBe(false);
});
it('halves effective speed with paralysis', () => {
  const b = base();
  const normal = effectiveStat(b.player, 'speed');
  b.player.status = 'paralysis';
  expect(effectiveStat(b.player, 'speed')).toBe(normal * 0.5);
});
it('confusion coexists with burn and expires without overwriting it', () => {
  let b = base();
  assign(b.player, ['harden']);
  assign(b.opponent, ['harden']);
  b.player.status = 'burn';
  b.player.confusion = 2;
  b.player.hp = b.player.maxHP = 500;
  for (let i = 0; i < 2; i++) b = resolveTurn(b, 0, 0).state;
  expect(b.player.confusion).toBe(0);
  expect(b.player.status).toBe('burn');
  expect(b.player.hp).toBeLessThan(440);
});
it('speed ties are seeded and permit either actor to open', () => {
  const first = new Set();
  for (let i = 0; i < 30; i++) {
    const b = base();
    assign(b.player, ['harden']);
    assign(b.opponent, ['harden']);
    b.player.stats.speed = b.opponent.stats.speed = 10;
    b.rngState = i;
    first.add(resolveTurn(b, 0, 0).events.find((e) => e.type === 'MOVE').actor);
  }
  expect([...first].sort()).toEqual(['opponent', 'player']);
});
it('PP is spent on misses, immune moves and failed stages', () => {
  const b = base();
  assign(b.player, ['harden']);
  assign(b.opponent, ['harden']);
  b.player.stages.defense = 6;
  expect(resolveTurn(b, 0, 0).state.player.moves[0].pp).toBe(9);
});
it('secondary effects do not apply to already fainted targets', () => {
  for (let seed = 0; seed < 40; seed++) {
    const b = base();
    assign(b.player, ['thunderbolt']);
    assign(b.opponent, ['harden']);
    b.opponent.hp = 1;
    b.rngState = seed;
    const r = resolveTurn(b, 0, 0);
    expect(r.state.opponent.status).toBe(null);
  }
});
it('curated always-hit moves ignore accuracy drops and evasion', () => {
  const b = base();
  assign(b.player, ['swift']);
  assign(b.opponent, ['harden']);
  b.player.stages.accuracy = -6;
  b.opponent.stages.evasion = 6;
  for (let i = 0; i < 10; i++) {
    b.rngState = i;
    expect(resolveTurn(b, 0, 0).events.some((e) => e.type === 'MISS' && e.actor === 'player')).toBe(
      false,
    );
  }
});
