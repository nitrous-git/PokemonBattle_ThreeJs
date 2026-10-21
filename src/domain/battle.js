import { pokemon, moves, economy } from '../data/catalogue.js';
import { RNG } from './random.js';
import {
  stats,
  draftMoves,
  damage,
  effectiveStat,
  effectiveness,
  accuracyMultiplier,
  legalMoves,
  getMove,
  mayApplyStatus,
} from './rules.js';
export function makeActor(speciesId, level, moveIds, instanceId = null) {
  const s = pokemon[speciesId],
    values = stats(speciesId, level);
  return {
    speciesId,
    name: s.displayName,
    instanceId,
    level,
    types: [...s.types],
    stats: values,
    maxHP: values.hp,
    hp: values.hp,
    stages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0, accuracy: 0, evasion: 0 },
    status: null,
    statusTurns: 0,
    confusion: 0,
    moves: moveIds.map((id) => ({ id, pp: moves[id].maxPP, maxPP: moves[id].maxPP })),
  };
}
export function createBattle({
  instance,
  opponentId,
  tier = 'rival',
  difficulty = 'normal',
  seed,
  battleId,
}) {
  const rng = new RNG(seed),
    level = Math.max(3, Math.min(50, instance.level + economy.tiers[tier].delta));
  return {
    battleId,
    seed,
    rngState: rng.state,
    turn: 1,
    phase: 'selection',
    winner: null,
    sequence: 0,
    tier,
    difficulty,
    player: makeActor(instance.speciesId, instance.level, instance.moveIds, instance.instanceId),
    opponent: makeActor(opponentId, level, draftMoves(opponentId, rng)),
    ...{ rngState: rng.state },
  };
}
/** Pure transition. Both legal choices must exist before resolution. No UI or AI input leaks. */
export function resolveTurn(snapshot, playerSlot, opponentSlot) {
  if (snapshot.phase !== 'selection') throw Error('Battle is already ended');
  if (
    !legalMoves(snapshot.player).includes(playerSlot) ||
    !legalMoves(snapshot.opponent).includes(opponentSlot)
  )
    throw Error('Illegal command');
  const state = structuredClone(snapshot),
    rng = new RNG(state.rngState),
    events = [];
  const emit = (type, actor, payload = {}) =>
    events.push(
      Object.freeze({
        battleId: state.battleId,
        seq: state.sequence++,
        turn: state.turn,
        type,
        actor,
        ...payload,
      }),
    );
  const hurt = (side, amount, cause, extra = {}) => {
    const a = state[side],
      before = a.hp;
    a.hp = Math.max(0, a.hp - amount);
    emit('DAMAGE', side, {
      amount: before - a.hp,
      beforeHP: before,
      afterHP: a.hp,
      cause,
      ...extra,
    });
  };
  const clear = (side) => {
    const a = state[side];
    emit('STATUS_CLEARED', side, { status: a.status });
    a.status = null;
    a.statusTurns = 0;
  };
  const blocked = (side) => {
    const a = state[side];
    if (a.status === 'sleep') {
      if (a.statusTurns > 0) {
        a.statusTurns--;
        emit('BLOCKED', side, { reason: 'sleep' });
        return true;
      }
      clear(side);
    }
    if (a.status === 'freeze') {
      if (rng.next() < 0.2) clear(side);
      else {
        emit('BLOCKED', side, { reason: 'freeze' });
        return true;
      }
    }
    if (a.status === 'paralysis' && rng.next() < 0.25) {
      emit('BLOCKED', side, { reason: 'paralysis' });
      return true;
    }
    if (a.confusion > 0) {
      a.confusion--;
      if (rng.next() < 1 / 3) {
        emit('BLOCKED', side, { reason: 'confusion' });
        hurt(
          side,
          damage(
            a,
            a,
            { power: 40, category: 'physical' },
            { typeless: true, variance: rng.int(85, 100) / 100 },
          ),
          'confusion',
        );
        return true;
      }
      if (!a.confusion) emit('CONFUSION_CLEARED', side);
    }
    return false;
  };
  const action = (side, slot) => {
    const target = side === 'player' ? 'opponent' : 'player',
      a = state[side],
      b = state[target];
    if (a.hp <= 0 || b.hp <= 0) return;
    const m = getMove(a, slot);
    if (slot >= 0) {
      a.moves[slot].pp--;
      emit('PP', side, { slot, pp: a.moves[slot].pp });
    }
    if (blocked(side)) return;
    emit('MOVE', side, { moveId: m.id, name: m.name, target: m.target === 'self' ? side : target });
    const acc = m.alwaysHit
      ? 1
      : (m.accuracy / 100) * accuracyMultiplier(a.stages.accuracy - b.stages.evasion);
    if (!m.alwaysHit && rng.next() >= acc) {
      emit('MISS', side);
      return;
    }
    const mult = m.type === 'typeless' ? 1 : effectiveness(m.type, b.types);
    if ((m.category !== 'status' || m.immunityRule === 'type-chart') && mult === 0) {
      emit('IMMUNE', target);
      return;
    }
    emit('VFX', side, {
      target: m.target === 'self' ? side : target,
      moveId: m.id,
      moveType: m.type,
      category: m.category,
    });
    let dealt = 0,
      changed = false;
    for (const effect of m.effects) {
      if (
        effect.kind !== 'DAMAGE' &&
        effect.chance !== undefined &&
        effect.chance < 1 &&
        rng.next() >= effect.chance
      )
        continue;
      const recipient = effect.target === 'self' || m.target === 'self' ? side : target,
        c = state[recipient];
      if (effect.kind === 'DAMAGE') {
        const crit = rng.next() < (m.critChance || 1 / 16),
          amount = damage(a, b, m, { critical: crit, variance: rng.int(85, 100) / 100 });
        dealt = Math.min(amount, b.hp);
        hurt(target, amount, m.id, { critical: crit, effectiveness: mult });
        changed = true;
      } else if (effect.kind === 'RECOIL') {
        hurt(side, Math.max(1, Math.floor(dealt * effect.recoilFraction)), 'recoil');
        changed = true;
      } else if (
        c.hp > 0 &&
        effect.kind === 'APPLY_MAJOR_STATUS' &&
        mayApplyStatus(c, effect.status)
      ) {
        c.status = effect.status;
        c.statusTurns = effect.status === 'sleep' ? rng.int(1, 3) : 0;
        emit('STATUS', recipient, { status: c.status, duration: c.statusTurns });
        changed = true;
      } else if (c.hp > 0 && effect.kind === 'APPLY_CONFUSION' && c.confusion === 0) {
        c.confusion = rng.int(2, 4);
        emit('STATUS', recipient, { status: 'confusion', duration: c.confusion });
        changed = true;
      } else if (c.hp > 0 && effect.kind === 'STAT_STAGE') {
        const before = c.stages[effect.stat];
        c.stages[effect.stat] = Math.max(-6, Math.min(6, before + effect.stages));
        if (before !== c.stages[effect.stat]) {
          emit('STAGE', recipient, { stat: effect.stat, delta: c.stages[effect.stat] - before });
          changed = true;
        }
      }
    }
    if (!changed) emit('FAILED', side);
  };
  const p = getMove(state.player, playerSlot),
    o = getMove(state.opponent, opponentSlot),
    speedDelta = effectiveStat(state.player, 'speed') - effectiveStat(state.opponent, 'speed');
  const first =
    p.priority !== o.priority
      ? p.priority > o.priority
        ? 'player'
        : 'opponent'
      : speedDelta
        ? speedDelta > 0
          ? 'player'
          : 'opponent'
        : rng.next() < 0.5
          ? 'player'
          : 'opponent';
  emit('TURN', first);
  if (first === 'player') {
    action('player', playerSlot);
    action('opponent', opponentSlot);
  } else {
    action('opponent', opponentSlot);
    action('player', playerSlot);
  }
  for (const side of ['player', 'opponent']) {
    const a = state[side];
    if (a.hp > 0 && ['burn', 'poison'].includes(a.status))
      hurt(side, Math.max(1, Math.floor(a.maxHP / (a.status === 'burn' ? 16 : 8))), a.status);
  }
  for (const side of ['player', 'opponent']) if (state[side].hp <= 0) emit('FAINT', side);
  if (state.player.hp <= 0 || state.opponent.hp <= 0) {
    state.phase = 'ended';
    state.winner = state.player.hp <= 0 ? (state.opponent.hp <= 0 ? 'draw' : 'opponent') : 'player';
    emit('END', state.winner);
  } else state.turn++;
  state.rngState = rng.state;
  return { state, events, result: state.phase === 'ended' ? battleResult(state) : null };
}
export function rewardEstimate(level, tier, difficulty) {
  const t = economy.tiers[tier].multiplier;
  return {
    coins: Math.round((30 + level * 8) * t * economy.difficulty[difficulty]),
    xp: Math.round((45 + level * 15) * t),
  };
}
export function battleResult(state) {
  const win = state.winner === 'player',
    draw = state.winner === 'draw',
    base = rewardEstimate(state.opponent.level, state.tier, state.difficulty);
  return Object.freeze({
    battleId: state.battleId,
    outcome: state.winner,
    instanceId: state.player.instanceId,
    opponentId: state.opponent.speciesId,
    turns: state.turn,
    coins: win ? base.coins : 10,
    xp: win ? base.xp : draw ? 0 : Math.round(base.xp * 0.2),
  });
}
