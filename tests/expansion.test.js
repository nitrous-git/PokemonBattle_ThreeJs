import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import * as THREE from 'three';
import { ArenaScene } from '../src/render/ArenaScene.js';
import { pokemon, moves } from '../src/data/catalogue.js';
import { ownedInstance, purchase, validateSave, applyReward } from '../src/domain/progression.js';
import { createBattle, resolveTurn } from '../src/domain/battle.js';
import { chooseAI } from '../src/domain/ai.js';
import { damage } from '../src/domain/rules.js';
import { resolveMoveVFX } from '../src/render/MoveVFX.js';
import { read, hash } from '../scripts/io.mjs';
const additions = [
  'mewtwo',
  'rayquaza',
  'lugia',
  'darkrai',
  'lucario',
  'garchomp',
  'gengar',
  'tyranitar',
];
const newMoves = ['aura-sphere', 'dark-pulse', 'earthquake', 'dragon-pulse', 'draco-meteor'];
const identity = (id, seed = 42) => ({ seed, instanceId: `new-${id}`, acquiredAt: '2026-10-22' });
function battle(id = 'rayquaza', opponent = 'lugia', seed = 42) {
  return createBattle({
    instance: ownedInstance(id, identity(id, seed)),
    opponentId: opponent,
    seed,
    battleId: `d1-${id}-${seed}`,
  });
}
function withMove(id, opponent = 'lugia', seed = 42) {
  const b = battle('rayquaza', opponent, seed);
  b.player.moves = [{ id, pp: moves[id].maxPP, maxPP: moves[id].maxPP }];
  b.opponent.moves = [{ id: 'harden', pp: 30, maxPP: 30 }];
  b.opponent.hp = b.opponent.maxHP = 5000;
  return b;
}
describe('D1 content and compatibility', () => {
  it('adds exactly the approved roster, source-backed stats, types and reviewed moves', async () => {
    expect(Object.keys(pokemon).slice(16)).toEqual(additions);
    expect(Object.keys(moves).slice(61)).toEqual(newMoves);
    expect(
      additions.map((id) => [pokemon[id].dexNumber, pokemon[id].types, pokemon[id].rarity]),
    ).toEqual([
      [150, ['psychic'], 'legendary'],
      [384, ['dragon', 'flying'], 'legendary'],
      [249, ['psychic', 'flying'], 'legendary'],
      [491, ['dark'], 'mythical'],
      [448, ['fighting', 'steel'], 'elite'],
      [445, ['dragon', 'ground'], 'elite'],
      [94, ['ghost', 'poison'], 'rare'],
      [248, ['rock', 'dark'], 'elite'],
    ]);
    expect(
      additions.map((id) => Object.values(pokemon[id].baseStats).reduce((a, b) => a + b)),
    ).toEqual([680, 680, 680, 600, 525, 600, 500, 600]);
    const audit = await read('src/data/generated/learnsetAudit.json');
    for (const id of additions) {
      const rows = audit.filter((row) => row.speciesId === id);
      expect(rows.length).toBe(pokemon[id].legalMoves.length);
      expect(rows.every((row) => row.supportedInSomeVersion && !row.customExceptionReason)).toBe(
        true,
      );
    }
  });
  it('loads a pre-D1 save without changing owned identities, drafts, XP, wallet or settings', async () => {
    const old = await read('tests/fixtures/pre-d1-save.json');
    expect(validateSave(old)).toEqual(old);
    let save = structuredClone(old);
    save.trainer.coins = 30000;
    for (const id of additions) {
      const before = save;
      save = purchase(save, id, identity(id));
      expect(save.trainer.coins).toBe(before.trainer.coins - pokemon[id].priceCoins);
      expect(() => purchase(save, id, identity(id))).toThrow('Already');
    }
    expect(save.collection).toHaveLength(24);
    expect(save.collection.slice(0, 16)).toEqual(old.collection);
    expect(validateSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
    const reward = {
      battleId: 'expansion-reward',
      instanceId: save.collection.at(-1).instanceId,
      coins: 70,
      xp: 100,
    };
    const rewarded = applyReward(save, reward);
    expect(applyReward(rewarded, reward)).toEqual(rewarded);
  });
  it('fits both large-sprite orientations at desktop, narrow and phone sizes without stretching', async () => {
    const manifest = await read('src/data/generated/spriteManifest.json');
    for (const [width, height, fov] of [
      [1440, 1000, 36],
      [600, 800, 68],
      [390, 844, 68],
    ]) {
      const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 180);
      camera.position.set(0, 9.6, 17);
      camera.lookAt(0, 0.65, 0);
      camera.updateMatrixWorld();
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      for (const id of additions)
        for (const side of ['front', 'back']) {
          const [w, h] = manifest[id][side].size;
          const base = new THREE.Vector3(...(side === 'back' ? [-3, 0.29, 2.7] : [3, 0.29, -3.1]));
          const actor = {
            base,
            sprite: new THREE.Sprite(),
            aspect: w / h,
            nominalHeight: pokemon[id].arenaHeight,
            fitToViewport: true,
          };
          ArenaScene.prototype.fitActor.call({ mode: 'battle', camera }, actor);
          expect(actor.sprite.scale.x / actor.sprite.scale.y).toBeCloseTo(w / h);
          for (const x of [-0.5, 0.5])
            for (const y of [0, 1]) {
              const corner = base
                .clone()
                .addScaledVector(right, actor.sprite.scale.x * x)
                .addScaledVector(up, actor.sprite.scale.y * y)
                .project(camera);
              expect(Math.abs(corner.x)).toBeLessThan(1);
              expect(Math.abs(corner.y)).toBeLessThan(1);
            }
          actor.sprite.material.dispose();
        }
    }
  });
  it.each(additions)(
    '%s has actual changing front/back animation and local static portraits',
    async (id) => {
      const manifest = await read('src/data/generated/spriteManifest.json');
      for (const side of ['front', 'back']) {
        const a = manifest[id][side];
        expect(a.rightsStatus).toBe('copyrighted-restricted');
        expect(a.fallbackReason).toBe(null);
        expect(a.frames.length).toBeGreaterThan(1);
        const signatures = new Set();
        for (const index of [
          0,
          Math.floor(a.frames.length / 3),
          Math.floor((a.frames.length * 2) / 3),
        ]) {
          const [left, top, width, height] = a.frames[index].rectPx;
          signatures.add(
            hash(
              (
                await sharp(`public/${a.atlasUrl}`)
                  .extract({ left, top, width, height })
                  .raw()
                  .toBuffer()
              ).toString('base64'),
            ),
          );
        }
        expect(signatures.size).toBeGreaterThan(1);
        expect((await sharp(`public/${a.staticUrl}`).metadata()).width).toBe(a.size[0]);
      }
    },
  );
});
describe('D1 supported move effects', () => {
  it.each(newMoves)('%s consumes PP and resolves deterministic damage', (id) => {
    const b = withMove(id);
    const result = resolveTurn(b, 0, 0);
    expect(resolveTurn(b, 0, 0)).toEqual(result);
    expect(result.state.player.moves[0].pp).toBe(moves[id].maxPP - 1);
    // Earthquake is immune against Lugia; other new attacks hit at this seed.
    if (id === 'earthquake') expect(result.events.some((e) => e.type === 'IMMUNE')).toBe(true);
    else expect(result.state.opponent.hp).toBeLessThan(b.opponent.hp);
  });
  it('Aura Sphere ignores accuracy/evasion but respects Ghost immunity', () => {
    const b = withMove('aura-sphere');
    b.player.stages.accuracy = -6;
    b.opponent.stages.evasion = 6;
    for (let seed = 1; seed <= 30; seed++) {
      b.rngState = seed;
      expect(resolveTurn(b, 0, 0).state.opponent.hp).toBeLessThan(b.opponent.hp);
    }
    const immune = withMove('aura-sphere', 'gengar');
    expect(resolveTurn(immune, 0, 0).state.opponent.hp).toBe(immune.opponent.hp);
  });
  it('Earthquake uses physical Ground damage; Dark Pulse adds no flinch', () => {
    const ground = withMove('earthquake', 'tyranitar');
    expect(resolveTurn(ground, 0, 0).state.opponent.hp).toBeLessThan(ground.opponent.hp);
    expect(moves.earthquake.category).toBe('physical');
    expect(moves['dark-pulse'].effects).toEqual([{ kind: 'DAMAGE' }]);
  });
  it('Draco Meteor drops only its user after damage, including KO; clamps and weakens subsequent hits', () => {
    const before = withMove('draco-meteor');
    const after = resolveTurn(before, 0, 0);
    expect(after.state.player.stages.spAttack).toBe(-2);
    expect(after.state.opponent.stages.spAttack).toBe(0);
    expect(after.events.findIndex((e) => e.type === 'DAMAGE')).toBeLessThan(
      after.events.findIndex((e) => e.type === 'STAGE' && e.actor === 'player'),
    );
    const options = { critical: false, variance: 1 };
    expect(
      damage(after.state.player, after.state.opponent, moves['draco-meteor'], options),
    ).toBeLessThan(damage(before.player, before.opponent, moves['draco-meteor'], options));
    before.player.stages.spAttack = -5;
    expect(resolveTurn(before, 0, 0).state.player.stages.spAttack).toBe(-6);
    before.opponent.hp = 1;
    expect(resolveTurn(before, 0, 0).state.player.stages.spAttack).toBe(-6);
    const miss = withMove('draco-meteor');
    miss.player.stages.accuracy = -6;
    miss.opponent.stages.evasion = 6;
    let observedMiss = false;
    for (let seed = 1; seed < 100; seed++) {
      miss.rngState = seed;
      const r = resolveTurn(miss, 0, 0);
      if (r.events.some((e) => e.type === 'MISS' && e.actor === 'player')) {
        expect(r.state.player.stages.spAttack).toBe(0);
        observedMiss = true;
        break;
      }
    }
    expect(observedMiss).toBe(true);
    const immune = withMove('draco-meteor');
    immune.opponent.types = ['fairy'];
    expect(resolveTurn(immune, 0, 0).state.player.stages.spAttack).toBe(0);
  });
  it('maps new moves into existing VFX tiers with reduced/low motion support', () => {
    const styles = ['orb', 'orb', 'eruption', 'beam', 'meteor'];
    newMoves.forEach((id, i) => {
      expect(resolveMoveVFX({}, moves[id]).style).toBe(styles[i]);
      expect(resolveMoveVFX({}, moves[id], { reducedMotion: true, lowVFX: true })).toMatchObject({
        reduced: true,
        low: true,
        duration: 0.28,
      });
    });
    expect(resolveMoveVFX({}, moves['draco-meteor']).tier).toBe(3);
  });
  it('ordinary, elite and legendary matchups finish with valid deterministic rewards', () => {
    for (const opponent of ['rayquaza', 'mewtwo', 'garchomp', 'darkrai'])
      for (const player of ['pikachu', 'blastoise', 'lucario', 'lugia'])
        for (const seed of [7, 42, 91]) {
          let b = battle(player, opponent, seed),
            result;
          for (let turn = 0; turn < 200 && b.phase === 'selection'; turn++) {
            const slot = chooseAI({ ...b, player: b.opponent, opponent: b.player });
            const command = chooseAI(b);
            const out = resolveTurn(b, slot, command);
            expect(resolveTurn(b, slot, command)).toEqual(out);
            b = out.state;
            result = out.result;
          }
          expect(result).toBeTruthy();
          expect(result.coins).toBeGreaterThanOrEqual(0);
          expect(b.player.hp).toBeGreaterThanOrEqual(0);
          expect(b.opponent.hp).toBeGreaterThanOrEqual(0);
        }
  });
});
