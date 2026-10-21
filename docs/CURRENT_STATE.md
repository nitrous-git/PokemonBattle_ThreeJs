# Current state — Battle Atelier

**Baseline:** `New-features`, 2026-10-21, with the Phase A attack VFX upgrade and Phase B VS introduction. This file records **what is implemented** rather than promising future features.

## Playable today

- Static GitHub Pages / native browser ES modules; pinned Three.js `0.180.0` CDN import map; no bundler or production Node process.
- 16 curated Pokémon and 61 moves; 18 types, 18x18 type-effectiveness table, dual-type multipliers and immunities.
- Initial starter choice: Pikachu, Bulbasaur, Charmander, Squirtle. One owned Pokémon selected per battle; 1v1 player-versus-AI.
- Setup: opponent selection/filter, randomized opponent, challenge tiers (Rookie/Rival/Champion), AI (Easy/Normal/Hard), three arenas (Verdant Meadow, Crimson Canyon, Astral Chamber).
- Battles: four acquired moves per Pokémon, PP, accuracy, priority/speed, physical/special/status effects, stat stages, critical hits, burn/paralysis/sleep/freeze/poison, volatile confusion, recoil and Struggle fallback.
- Deterministic turn resolver with semantic combat events; three AI difficulties (Easy weighted, Normal heuristic, Hard bounded sampled two-turn search).
- Presentation: Three.js procedural backgrounds and animated front/back sprite atlases, camera feedback, audio, battle journal, speed/skip, reduced-motion/low-VFX options, WebGL failure fallback.
- Attack VFX 2.0: `src/render/MoveVFX.js` resolves authored presets and move power into light/strong/signature effects (0.58/0.78/1.02 seconds at 1×). Fire streams, water jets/bubbles, branching lightning, thrown/falling rocks and dust, ice beams/shards, slashes/claws, energy orbs and leaves share procedural geometry, typed colors, impact rings and soft local glow. Status moves use target-centered auras; reduced motion uses a short stationary pulse.
- VFX playback waits for renderer completion, scales with live battle speed, and cancels on Skip, context loss, actor replacement or disposal. Elapsed effect time stays independent of the ambient frame cap. Low VFX reduces geometry/particles; no postprocessing or new runtime dependency.
- VS introduction: new battles and Results replay show a local-portrait warm/cool diagonal matchup overlay for 1.65 seconds, independent of turn speed. Portrait phones use a stacked layout. Button/Space Skip, a 180ms static Reduced Motion reveal, bounded asset preparation, missing-art/WebGL fallback, isolated intro input locking, cancellation cleanup and restored move focus are supported. Two restrained synthesized cues respect audio settings.
- Results/replay, XP/levels (cap 50), coins, permanent unlock shop, owned collection and saved settings. Save export, localStorage validation/recovery, transaction/double-reward defenses.
- Appearance: Settings offers immediate Light (default) and Midnight Dark themes across screens, controls, dialogs and notifications. The preference persists before starter selection and in version 1 saves; older saves default to Light and invalid values use existing recovery. Early root theme application limits startup flashing. Arena rendering, type hues and the VS cinematic retain their presentation.
- Native HTML templates for screens and confirmation dialog, separate UI state bindings and shared components. Responsive CSS and keyboard shortcuts (`1`–`4`, Space skip, Escape from battle).

## Scope limits / explicit non-features

No overworld, exploration, multiplayer/backend, capture mechanic, evolution, abilities, held items, trainer party switching during combat, or comprehensive cartridge-accurate Gen-V rules. Battles are not resumable from localStorage. Save import UI has not been implemented (export is available). Don't present these as already implemented.

## Next work: proposals, **not approved tasks**

Feature options include roster/move expansion, improved encounter variety, collection UX, balance and combat depth. Do **not** preimplement any of these without the next user task. For each feature, clarify which gameplay contracts and tests change, preserve saves, and keep the static deployment model.

## Baseline checks

`npm run test` — domain, status edges, assets, UI template tests. `npm run lint` — ESLint. `npm run data:validate` and `npm run assets:check` — authoring integrity. `npm run test:browser` — Playwright end-to-end workflow (additional Chromium installation may be needed). `node scripts/vfx-qa.mjs` adds focused VFX captures, repository-subpath checks, speed/Skip/context-loss checks and repeated-effect resource checks. `node scripts/intro-qa.mjs` checks intro timing, input locking, cancellation, replay, missing-art/WebGL fallback, touch and responsive repository-subpath layouts. Run relevant commands and report results, not assumed passes.

When a feature is delivered and verified, update only the factual bullets that changed. Never rewrite this file from aspirational design notes.

`node scripts/theme-qa.mjs` checks theme persistence, save compatibility, both-theme screen coverage, representative contrast, responsive layouts and Phase A/B behavior under the repository subpath, and captures screenshots.
