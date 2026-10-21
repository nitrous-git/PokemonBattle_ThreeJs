# Architecture and implementation contracts

This describes the **current static build**, not the original Vite design proposal. See `AGENTS.md` for targeted reading and change policy.

## Runtime and ownership

```text
index.html                 HTML shell, #arena, #app, CDN import map
  src/main.js              loadTemplates() -> new GameApp(#app)
  src/app/GameApp.js       input delegation, routes, save/audio, turn presentation
  src/ui/templates.html    structural HTML templates (loaded once via same-origin fetch)
  src/ui/screens.js        clone templates, bind state, render dynamic lists
  src/ui/components.js     reusable trusted dynamic HTML (cards, HUD, badges, sprites)
  src/styles/style.css     styles, layout, responsive rules
  src/render/ArenaScene.js Three.js renderer, arenas, sprite atlas playback, VFX
  src/services/            SaveService, AudioService
  src/domain/              battle, rules, AI, progression, seeded RNG, validation
  src/data/catalogue.js    local JSON imports (generated catalogue + authored economy)
  src/assetUrl.js          resolve public/ URLs under GitHub Pages repo subpaths
```

Third-party Three.js is pinned to `0.180.0` in the `index.html` import map. `src/main.js` loads `src/ui/templates.html` via `new URL('./templates.html', import.meta.url)` and a single same-origin fetch **before** constructing `GameApp`. There is no Vite, React or production npm dependency. Keep the stable canvas outside `#app` so screen navigation never destroys WebGL.

## UI change contract

- Routes handled by `createScreen(app)`: `menu`, `starter`, `setup`, `collection`, `shop`, `battle`, `results`, `settings`, `credits`; a save error shows the `recovery` template. Shop and collection share `screen-catalogue` with differing state.
- Structural markup: add/edit a `<template id="screen-...">` in `src/ui/templates.html`; data-only text placeholders use `data-bind`, complex controlled markup uses `data-slot`.
- Bindings and route switch live in `src/ui/screens.js` (`loadTemplates`, `createHeader`, `createFooter`, `createScreen`, `createModal`). Add route behavior in `GameApp` only when state or interaction changes.
- `GameApp` delegates click/change/input via `#app`; preserve `data-action`, `data-route`, `data-id`, `data-slot` and settings/control IDs. CSS classes are a styling and browser-test contract.
- Important controls/targets: `#filter`, `#owned-select`, `#tier`, `#difficulty`, `#arena-select`, `#volume`, `#uiScale`, `#speed`, `#opponent-hud`, `#player-hud`, `.battle-log`, `.move-button`, `#battle-floats`.
- `textContent` for dynamic strings. Controlled `innerHTML` is acceptable for escaped/trusted component fragments (current incremental HUD/log rendering uses this). Avoid arbitrary user or save strings in markup.
- Preserve `#app` replacement pattern; targeted HUD updates may be incremental during animations. Screens are not reactive components or a third-party UI library.

## Battle and progression contract

- `src/domain/battle.js`: `createBattle({instance, opponentId, tier, difficulty, seed, battleId})`; pure `resolveTurn(snapshot, playerSlot, opponentSlot)` returns `{state, events, result}`. No DOM, rendering, IO or side effects inside the turn resolver.
- Battle state includes `player`/`opponent` actors, `rngState`, turn, phase, unique battleId and resolved outcome. Event stream drives VFX/HUD/audio **after** authoritative state resolution. Event names include `MOVE`, `PP`, `DAMAGE`, `VFX`, `STATUS`, `BLOCKED`, `FAINT` and `END` (see source for full set).
- `src/domain/rules.js`: battle math, stats, effectiveness, move drafting/legal moves. `src/domain/ai.js`: `chooseAI(snapshot)` sees the pre-command state, not the player's selected move. Rules/AI remain testable without WebGL.
- `src/domain/progression.js`: new save, purchase, rewards, migrations/validation; `src/services/SaveService.js`: localStorage read/commit/reset/export raw. Storage key: `nitrous.battle-atelier.v1`; save schema: **`saveVersion: 1`**; revision guards against stale-tab overwrites.
- Acquired Pokémon have stable `instanceId`, `speciesId`, XP/level and a persistent four-move `moveIds` draft. Purchases are one unlock per species in current UI. Rewards are committed by `battleId` and should not duplicate. Combat snapshots are not persisted; an unfinished battle does not earn a completion reward.
- Treat changes to save format, event order or combat rules as **migration/test work**, not cosmetic changes. Do not reset existing saves to sidestep compatibility.

## Renderer and runtime assets

`ArenaScene.js` owns three procedural arenas (`meadow`, `canyon`, `astral`), sprite asset loading/atlas animation, camera, effects, resizing, context recovery and cleanup. Sprites are local files referenced by `src/data/generated/spriteManifest.json`; URLs are resolved using `assetUrl()`. Do not hotlink runtime Pokémon sprites from PokéAPI, or change the pinned Three.js version without verification.

## Feature delivery checklist

- Determine whether the task changes domain rules, content pipeline, UI, renderer, save schema or multiple boundaries.
- Preserve interactions, responsiveness, accessibility, reduced motion and static repo-subpath hosting.
- Run targeted unit tests; add edge-case tests for new rules/statuses; run lint. For new screens, update `tests/ui-templates.test.js` and perform screen/navigation QA. For combat UI, check battle skip, double-click behavior and reward integrity.
- Report precise validation coverage and any unverified browser/hardware behavior. Update `CURRENT_STATE.md` only for shipped features.
