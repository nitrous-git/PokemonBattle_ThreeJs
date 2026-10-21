import { RNG } from './random.js';
import { damage, legalMoves, getMove, mayApplyStatus, effectiveness } from './rules.js';
import { resolveTurn } from './battle.js';
export function utility(actor, foe, slot) {
  const m = getMove(actor, slot);
  let score = m.power
    ? damage(actor, foe, m, { variance: 0.925 }) * (m.alwaysHit ? 1 : m.accuracy / 100)
    : 0;
  if (m.immunityRule === 'type-chart' && !effectiveness(m.type, foe.types)) return -1;
  for (const e of m.effects) {
    const chance = e.chance ?? 1;
    if (e.kind === 'APPLY_MAJOR_STATUS' && mayApplyStatus(foe, e.status))
      score += foe.maxHP * 0.2 * chance;
    if (e.kind === 'APPLY_CONFUSION' && !foe.confusion) score += foe.maxHP * 0.14 * chance;
    if (e.kind === 'STAT_STAGE') {
      const a = e.target === 'self' ? actor : foe;
      if (Math.abs(a.stages[e.stat]) < 6) score += actor.maxHP * 0.09 * chance;
    }
    if (e.kind === 'RECOIL') score *= 0.8;
  }
  return score;
}
function evaluate(s) {
  if (s.winner === 'opponent') return 10000;
  if (s.winner === 'player') return -10000;
  if (s.winner === 'draw') return 0;
  const value = (a) =>
    (a.hp / a.maxHP) * 100 -
    (a.status ? 9 : 0) -
    (a.confusion ? 4 : 0) +
    Object.values(a.stages).reduce((n, x) => n + x * 2, 0);
  return value(s.opponent) - value(s.player);
}
/** Hard: two complete turns of sampled minimax; max 16 + 256 = 272 transitions.
 * Stochastic branches use deterministic common random numbers. Samples approximate,
 * rather than exactly enumerate, accuracy/status/critical outcomes. No pending input. */
export function chooseAI(snapshot, difficulty = snapshot.difficulty) {
  const rng = new RNG((snapshot.seed ^ Math.imul(snapshot.turn, 7919)) >>> 0),
    options = legalMoves(snapshot.opponent);
  if (difficulty === 'easy') {
    const weights = options.map((x) =>
        Math.max(1, utility(snapshot.opponent, snapshot.player, x) * 0.6),
      ),
      total = weights.reduce((a, b) => a + b, 0);
    let r = rng.next() * total;
    return options.find((_, i) => (r -= weights[i]) < 0) ?? options[0];
  }
  if (difficulty === 'normal')
    return options
      .map((slot) => ({
        slot,
        value: utility(snapshot.opponent, snapshot.player, slot) + rng.next() * 0.15,
      }))
      .sort((a, b) => b.value - a.value)[0].slot;
  const transition = (state, p, o) => {
    const copy = { ...state, rngState: (state.seed ^ Math.imul(state.turn, 104729)) >>> 0 };
    return resolveTurn(copy, p, o).state;
  };
  const choices = options.map((slot) => {
    let worst = Infinity;
    for (const p of legalMoves(snapshot.player)) {
      const next = transition(snapshot, p, slot);
      let score = evaluate(next);
      if (next.phase !== 'ended') {
        let best = -Infinity;
        for (const o2 of legalMoves(next.opponent)) {
          let low = Infinity;
          for (const p2 of legalMoves(next.player))
            low = Math.min(low, evaluate(transition(next, p2, o2)));
          best = Math.max(best, low);
        }
        score = score * 0.2 + best * 0.8;
      }
      worst = Math.min(worst, score);
    }
    return {
      slot,
      value: worst + utility(snapshot.opponent, snapshot.player, slot) * 0.02 + rng.next() * 0.01,
    };
  });
  return choices.sort((a, b) => b.value - a.value)[0].slot;
}
