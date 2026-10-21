# Pokémon Battle Clone — Design & Astra Handoff Pack
**Version:** 2.0 — PokeAPI hybrid data / local-runtime baseline — 2026-10-20  
**Platform:** Desktop-first modern browsers; WebStorm local development  
**Stack:** Three.js + vanilla JavaScript (ES modules) + CSS + Vite; no React or TypeScript  
**Status:** Design contract, not implemented code

## Brief
Build a beautiful, standalone single-player Pokémon-inspired battle simulator with collection progression. A player chooses one of their owned Pokémon, chooses an opponent from a challenge catalogue, fights a one-on-one turn-based match, earns XP and coins, and spends coins to permanently unlock more Pokémon. Present classic front/back sprites in a genuinely dimensional WebGL arena, with animated attacks, polished HUD, clean state transitions, and persistent local saves. No overworld, exploration, multiplayer, backend, capture mechanics, or full Pokédex in v1.

## Contents and reading order
1. `01_GAME_DESIGN.md` — product scope, screen flows, mechanics, formulas, economy, AI, UX.
2. `02_ARCHITECTURE.md` — code map, ownership boundaries, battle state/events, data contracts, Three.js rendering and tests.
3. `03_CONTENT_ASSETS.md` — curated 16-species launch set, move catalogue, sprite-source priority, arena/UI/audio assets, rights.
4. `04_PRODUCTION_PLAN.md` — implementation phases, gates, completion criteria and regression matrix.
5. `05_ASTRA_WORK_PROMPT.md` — self-contained implementation brief suitable for Work/Astra handoff.
6. `06_HISTORICAL_JAVA_AUDIT.md` — notes from uploaded legacy Java prototype.
7. **`07_POKEAPI_DATA_PIPELINE.md` — normative external API import contracts, normalization, source provenance, animated sprite preparation and offline build.**

## Decisions fixed for v1
- Single 1v1 Pokémon per player and opponent per battle; no switching or party management.
- Each acquired individual has four distinct moves, **seeded-randomly drafted once at acquisition** from its legal curated pool, then persisted; moves do **not** reroll every battle. Opponent moves are seeded when a match is created.
- Six major statuses (burn, paralysis, sleep, freeze, poison) plus volatile confusion. The first five include user-requested statuses; poison is a small additional design choice.
- Eighteen Pokémon types and a canonical-looking 18×18 effectiveness table, stored locally and covered by tests. Dual-type effectiveness is multiplicative. Immunities remain exactly zero.
- Transparent front/back sprite art in a world-space Three.js arena. HUD, main menu, library, selection and shop are accessible HTML/CSS layered above or beside canvas.
- Three AI levels: Easy, Normal, Hard; Hard uses capped expectimax/minimax-style search over legal moves. AI never reads or touches UI/renderer.
- LocalStorage persistence with schema migrations and validation; export/import may be added after MVP.
- **PokeAPI is an authoring-time source**, not the runtime database. The game uses committed, validated local snapshot JSON for species, moves and type relations and local sprite assets; **no required remote requests in gameplay**.
- **Import provenance:** pin PokéAPI API version/source date and sprites Git SHA, normalize into stable ids, apply explicit curated overrides, validate, and produce a lock/manifest.
- **Visual inspiration:** `kkatsi/pokemon-battle` is the primary UI and framing reference; adapt its classic sprite composition but not its React stack or coupled battle logic.
- **Animated sprites:** prefer Gen-V front/back battle art where present. Use build-time GIF-to-atlas conversion with frame durations, static PNG fallback, and spritesheet playback in Three.js (no assumption that TextureLoader plays GIF).
- Gameplay target: concise, fair 2–5 minute matches. Mouse-first, keyboard-accessible menu controls.

## Reference audit — findings and cautions
- `kkatsi/pokemon-battle`: React/TypeScript project; README confirms four randomized moves, side conditions and class-based animations. `src/utils/moves.ts` labels a probability-weighted damage selector `minmaxMoveDecision`, but it is **not an actual Minimax tree search**. `src/utils/battle.ts` includes type logic, but its filtering and reduction around zero multipliers should **not** be copied (zero-valued immunities must not be dropped). Reimplement rules and architecture in plain JS.
- `markpascua680/PokemonClone`: C++/SDL project, mainly useful for battle layout and type-based amplification. Contains UI and Pokémon sprite assets but no evident top-level software LICENSE; do not assume code or art is reusable.
- `Kermalis/PokemonBattleEngine`: substantial C# engine emulating Gen 5, explicitly MIT for software. Useful as behavioral reference/test oracle for rule ordering, not suitable for direct port to browser prototype.
- `PokéPlunder`: useful inspiration for reward-loop/replayability, not a specification for a roguelike.
- Attached `src.rar`: inspected as an archive, including core Java files. It has Model `Pokemon`, `Attack`, `Trainer`; Swing/Java2D view `SelectionFrame`, `CombatSequence`; controller `EventHandler`; 2D attack frame folders. Already supports store/currency and player/opponent selection. Treat it as product-history reference only, with no architectural port.

## PokeAPI / sprite sourcing decision
- Reference APIs: `https://pokeapi.co/api/v2/pokemon/{id}/`, `move/{id-or-name}/`, `type/{id-or-name}/`, `pokemon-species/{id}/`, `growth-rate/{id}/` (last two for optional future evolution/EXP metadata). URLs are **importer inputs**, not game runtime dependencies.
- Use battle-source sprite manifest of *per-species validated available files*, with Gen V `black-white/animated` front/back as first preference, Gen V static PNG second, `other/showdown` as a reviewed stylistic fallback, then placeholder. Prefer self-hosted curated assets over hotlinks.
- Base stats/types from PokeAPI; battle move semantics and all economy values are **our** author-owned deterministic definitions/overrides.
- Do not mix learnset generations silently. In v1, curated moves are an intentionally cross-generation battle-simulator ruleset, with documented provenance; strict version-specific learnsets can be an optional validation mode.
- `07_POKEAPI_DATA_PIPELINE.md` resolves importer policy and asset-processing choices and is normative for those topics.

## Legal/asset boundary
Noncommercial, educational, and unofficial use does not automatically grant distribution rights. Pokémon names and official sprites belong to their owners. PokeSprite and PokeAPI/sprites both distinguish their repository distribution/code licenses from the underlying Pokémon artwork; PokeAPI/sprites explicitly says its images are copyright The Pokémon Company. The pack does NOT include proprietary sprites, fonts, music, or downloaded game assets. Astra should maintain `ASSET_CREDITS.md`, secure licenses for nonofficial assets, and clearly distinguish a private learning demo from a publicly distributable portfolio game. Never copy whole reference repositories or redisplay official Pokémon branding as an original commercial project.

## Source URLs
- https://github.com/kkatsi/pokemon-battle
- https://github.com/markpascua680/PokemonClone
- https://github.com/Kermalis/PokemonBattleEngine
- https://khydra98.itch.io/pokeplunder
- https://pokemondb.net/sprites
- https://github.com/msikma/pokesprite
- https://pokeapi.co/docs/v2
- https://pokeapi.co/
- https://github.com/PokeAPI/sprites
- https://github.com/PokeAPI/sprites/blob/master/LICENCE.txt
- https://threejs.org/docs/pages/SpriteMaterial.html
- https://vite.dev/guide/

## v2 change summary
- Added reproducible PokeAPI ingestion and local snapshot provenance; normalized source vs authored overrides.
- Clarified curated cross-generation move pools vs truly version-legal learnsets.
- Added Gen-V animated atlas and fallback art pipeline; rights status is mandatory per asset.
- Added import/asset CI gates and revised Astra instructions so no remote API calls occur during battles.
- No game source code or third-party proprietary artwork is included in this design-only package.
