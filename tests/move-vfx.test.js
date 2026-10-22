import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { MoveVFX, resolveMoveVFX } from '../src/render/MoveVFX.js';
import { ArenaScene } from '../src/render/ArenaScene.js';
import { moves } from '../src/data/catalogue.js';

const preset = (id, settings = {}) => resolveMoveVFX({ moveId: id }, moves[id], settings);
const create = (pool, id, settings = {}) =>
  pool.create(
    preset(id, settings),
    new THREE.Vector3(-3, 1.8, 2.7),
    new THREE.Vector3(3, 1.8, -3.1),
    new THREE.PerspectiveCamera(),
  );

describe('move presentation contracts', () => {
  it('gives the requested basic/strong pairs distinct scale, timing and style', () => {
    for (const [light, strong] of [
      ['ember', 'flamethrower'],
      ['water-gun', 'hydro-pump'],
      ['rock-throw', 'rock-slide'],
      ['thunder-shock', 'thunderbolt'],
    ]) {
      expect(preset(strong).tier).toBeGreaterThan(preset(light).tier);
      expect(preset(strong).size).toBeGreaterThan(preset(light).size);
      expect(preset(strong).duration).toBeGreaterThan(preset(light).duration);
    }
    expect(preset('flamethrower').style).toBe('stream');
    expect(preset('hydro-pump').style).toBe('beam');
    expect(preset('rock-slide').style).toBe('rain');
    expect(preset('dragon-claw').family).toBe('physical');
  });
  it('uses power thresholds, authored family metadata and safe future-move fallbacks', () => {
    for (const [power, tier] of [
      [40, 1],
      [54, 1],
      [55, 2],
      [89, 2],
      [90, 3],
      [150, 3],
    ]) {
      expect(resolveMoveVFX({}, { power }).tier).toBe(tier);
    }
    expect(resolveMoveVFX({ moveType: 'fire' }, { vfxPreset: 'water' }).family).toBe('water');
    expect(resolveMoveVFX({ moveId: 'future', moveType: 'ice' }).family).toBe('ice');
    expect(resolveMoveVFX({ moveType: 'future' }).color).toBe('#ffffff');
    expect(resolveMoveVFX()).toMatchObject({ family: 'physical', tier: 1 });
  });
  it('keeps all status moves out of damage tiers and suppresses travel for reduced motion', () => {
    for (const move of Object.values(moves)) {
      const c = preset(move.id);
      if (move.category === 'status') expect(c).toMatchObject({ tier: 0, family: 'status' });
      expect(preset(move.id, { reducedMotion: true })).toMatchObject({
        reduced: true,
        duration: 0.28,
      });
    }
  });
  it('runs every shipped move with finite transforms and completes without retaining scene objects', async () => {
    const pool = new MoveVFX();
    const parent = new THREE.Group();
    for (const id of Object.keys(moves)) {
      for (const settings of [{}, { lowVFX: true }, { reducedMotion: true }]) {
        const effect = create(pool, id, settings);
        parent.add(effect.group);
        for (let i = 0; i < 12; i++) {
          effect.update(effect.duration / 10);
          for (const node of effect.group.children) {
            expect(
              [...node.position, ...node.scale, node.material.opacity].every(Number.isFinite),
            ).toBe(true);
          }
        }
        await effect.finished;
        expect(effect.done).toBe(true);
        expect(parent.children).toHaveLength(0);
        expect(effect.materials.size).toBe(0);
      }
    }
    pool.dispose();
  });
  it('shares animation/completion time across live speed changes and resolves cancellation exactly once', async () => {
    const pool = new MoveVFX();
    const effect = create(pool, 'hydro-pump');
    const finished = vi.fn();
    effect.finished.then(finished);
    effect.update(0.2, 1);
    effect.update(0.2, 3);
    expect(effect.time).toBeCloseTo(0.8);
    expect(effect.done).toBe(false);
    effect.update(0.08, 3);
    await effect.finished;
    expect(effect.done).toBe(true);
    effect.dispose();
    expect(finished).toHaveBeenCalledTimes(1);
    const skipped = create(pool, 'rock-slide');
    skipped.dispose();
    await skipped.finished;
    expect(skipped.group.children).toHaveLength(0);
    pool.dispose();
  });
  it('finishes VFX after a slow frame even when ambient animation time is capped', async () => {
    const pool = new MoveVFX();
    const effect = create(pool, 'ice-beam');
    const scene = Object.assign(Object.create(ArenaScene.prototype), {
      settings: { speed: 1 },
      elapsed: 0,
      actors: {},
      effects: [effect],
      camera: new THREE.PerspectiveCamera(),
      baseCamera: new THREE.Vector3(0, 9, 17),
      target: new THREE.Vector3(),
      mode: 'battle',
    });
    scene.update(0.05, 1.1);
    await effect.finished;
    expect(scene.effects).toHaveLength(0);
    expect(scene.elapsed).toBe(0.05);
    pool.dispose();
  });
  it('meaningfully lowers effect cost and leaves shared resources alive until renderer disposal', () => {
    const pool = new MoveVFX();
    const disposeGeometry = vi.spyOn(pool.geometries.orb, 'dispose');
    for (const id of ['flamethrower', 'hydro-pump', 'thunderbolt', 'rock-slide']) {
      const full = create(pool, id),
        low = create(pool, id, { lowVFX: true });
      expect(low.group.children.length).toBeLessThan(full.group.children.length);
      full.dispose();
      low.dispose();
    }
    expect(disposeGeometry).not.toHaveBeenCalled();
    const reduced = create(pool, 'thunderbolt', { reducedMotion: true });
    reduced.update(0.1);
    expect(reduced.feedback).toBe(0);
    expect(reduced.group.children).toHaveLength(2);
    reduced.dispose();
    pool.dispose();
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
  });
});
