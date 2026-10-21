import { pokemon, economy, moves } from '../data/catalogue.js';
import { draftMoves } from './rules.js';
import { RNG } from './random.js';
export const DEFAULT_SETTINGS = {
  theme: 'dark',
  volume: 0.3,
  mute: false,
  music: true,
  reducedMotion: false,
  lowVFX: false,
  uiScale: 1,
  speed: 1,
};
export const levelForXP = (xp) => Math.max(5, Math.min(50, Math.floor(Math.cbrt(xp) + 1e-9)));
export function ownedInstance(speciesId, { seed, instanceId, acquiredAt }) {
  if (!pokemon[speciesId]) throw Error('Unknown species');
  return {
    instanceId,
    speciesId,
    level: 5,
    totalXP: 125,
    moveIds: draftMoves(speciesId, new RNG(seed)),
    variantSeed: seed,
    acquiredAt,
  };
}
export function newSave(speciesId, identity) {
  if (!['pikachu', 'bulbasaur', 'charmander', 'squirtle'].includes(speciesId))
    throw Error('Invalid starter');
  return {
    saveVersion: 1,
    revision: 0,
    trainer: { coins: economy.startCoins, chosenStarterId: speciesId },
    collection: [ownedInstance(speciesId, identity)],
    settings: { ...DEFAULT_SETTINGS },
    completedBattleIds: [],
  };
}
export function purchase(save, speciesId, identity) {
  const s = pokemon[speciesId];
  if (!s) throw Error('Unknown species');
  if (save.collection.some((p) => p.speciesId === speciesId))
    throw Error('Already in your collection');
  if (save.trainer.coins < s.priceCoins) throw Error('Not enough coins');
  const next = structuredClone(save);
  next.trainer.coins -= s.priceCoins;
  next.collection.push(ownedInstance(speciesId, identity));
  return next;
}
export function applyReward(save, result) {
  if (save.completedBattleIds.includes(result.battleId)) return save;
  const next = structuredClone(save),
    p = next.collection.find((x) => x.instanceId === result.instanceId);
  if (!p) throw Error('Reward participant missing');
  if (![result.coins, result.xp].every((v) => Number.isSafeInteger(v) && v >= 0))
    throw Error('Invalid reward');
  next.trainer.coins += result.coins;
  p.totalXP = Math.min(125000, p.totalXP + result.xp);
  p.level = levelForXP(p.totalXP);
  next.completedBattleIds.push(result.battleId);
  next.completedBattleIds = next.completedBattleIds.slice(-300);
  return next;
}
export function validateSave(input) {
  const s = structuredClone(input);
  if (s.saveVersion === 0) {
    s.saveVersion = 1;
    s.revision = s.revision || 0;
    s.settings = { ...DEFAULT_SETTINGS, ...s.settings };
    s.completedBattleIds = s.completedBattleIds || [];
    for (const p of s.collection || []) p.totalXP ??= p.level ** 3;
  }
  const fail = (msg) => {
    throw Error(`Save needs recovery: ${msg}`);
  };
  if (s.saveVersion !== 1) fail('unsupported version');
  if (!Number.isSafeInteger(s.revision) || s.revision < 0) fail('revision');
  if (!Number.isSafeInteger(s.trainer?.coins) || s.trainer.coins < 0) fail('wallet');
  if (!Array.isArray(s.collection) || !s.collection.length || s.collection.length > 1000)
    fail('collection');
  if (new Set(s.collection.map((p) => p.instanceId)).size !== s.collection.length)
    fail('duplicate instance IDs');
  for (const p of s.collection) {
    const species = pokemon[p.speciesId];
    if (!species || typeof p.instanceId !== 'string' || !p.instanceId)
      fail('species/instance identity');
    if (
      !Number.isInteger(p.totalXP) ||
      p.totalXP < 125 ||
      p.totalXP > 125000 ||
      p.level !== levelForXP(p.totalXP)
    )
      fail('XP/level');
    if (
      !Array.isArray(p.moveIds) ||
      p.moveIds.length !== 4 ||
      new Set(p.moveIds).size !== 4 ||
      p.moveIds.some((id) => !moves[id])
    )
      fail('unknown moves; saved choices were preserved');
  }
  if (
    !Array.isArray(s.completedBattleIds) ||
    s.completedBattleIds.some((x) => typeof x !== 'string')
  )
    fail('reward journal');
  s.settings = { ...DEFAULT_SETTINGS, ...s.settings };
  if (!['light', 'dark'].includes(s.settings.theme)) fail('theme');
  for (const key of ['mute', 'music', 'reducedMotion', 'lowVFX'])
    if (typeof s.settings[key] !== 'boolean') fail('settings');
  if (!Number.isFinite(s.settings.volume) || s.settings.volume < 0 || s.settings.volume > 1)
    fail('volume');
  if (![1, 2, 3].includes(s.settings.speed) || ![0.85, 1, 1.15].includes(s.settings.uiScale))
    fail('scale/speed');
  return s;
}
