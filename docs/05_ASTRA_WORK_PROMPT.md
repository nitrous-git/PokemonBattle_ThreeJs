# 05 — Astra / Work implementation prompt

> Paste the text below into a **new Work session** and attach the complete design pack and the historical `src.rar`. Provide a writable empty workspace or new Git repository, if possible. This is an implementation task, unlike the design session.

---

You are a senior Three.js/WebGL graphics engineer, JavaScript game architect, gameplay programmer, technical artist and QA lead. Build a **fully runnable, polished, single-player browser Pokémon battle simulator** in **vanilla JavaScript (ES6+), Three.js, HTML/CSS and Vite**, designed for development in **WebStorm**. You are implementing the game, **not merely suggesting architecture or stopping at scaffolding**.

## Inputs and priority
Read all attached files before implementation:
1. `README.md` (fixed v1 design decisions / reference findings)
2. `01_GAME_DESIGN.md` (normative mechanics, UI, economy)
3. `02_ARCHITECTURE.md` (pure-domain boundaries, schemas, tree, runtime constraints)
4. `03_CONTENT_ASSETS.md` (16 creatures, 61ish moves, assets, arenas and provenance)
5. `04_PRODUCTION_PLAN.md` (phases, acceptance and QA)
6. `07_POKEAPI_DATA_PIPELINE.md` (**normative** source-import, sprite-atlas and provenance contracts)
7. Historical user-owned `src.rar`, if supplied (product precedent only, not architecture to port).

The **strongest visual reference is `kkatsi/pokemon-battle`** (framing, sprites, combat HUD, selection flow). Reproduce the *feel* but implement original Vanilla JS/Three.js assets, UI and rules without React. External reference URLs provided in README: `kkatsi/pokemon-battle`, `markpascua680/PokemonClone`, `Kermalis/PokemonBattleEngine`, PokéPlunder, Pokémon Database sprites and PokeSprite. Inspect them selectively for ideas; do not copy architecture or source/assets without appropriate rights. The user's old Java implementation has trainer coins, store, player/opponent selection and sprite animation, but it is intentionally not a code baseline.

**Resolve conflicts:** fixed design decisions in README → rules in 01 → architecture in 02 → content in 03 → data provenance/import rules in 07 (normative for data) → production order in 04. If a tiny ambiguity remains, make a documented, consistent engineering choice without blocking progress. Prefer completed, working user-facing experiences over speculative extensibility.

## Non-negotiable technology
- **No React, Vue, Angular, TypeScript, multiplayer, backend, database, Java or WebGPU requirement.** Use vanilla ES modules and JSDoc typing; npm + Vite + pinned Three.js.
- `npm install && npm run dev` runs in WebStorm; `npm run build`, `npm run test`, `npm run lint` available.
- All important product screens implemented: intro/main menu, first-run starter picker, collection, battle setup with owned Pokémon and enemy selection, shop, battle and results, settings, credits.
- One owned Pokémon vs one enemy, four assigned moves, all specified statuses and 18-type effectiveness, move PP, speed/priority, XP, coin economy, permanent purchases, local save.
- **Separation of concerns:** no Three.js/DOM/audio/timers in domain and AI; renderer reacts to semantic battle events, never decides damage, HP or currency. Architecture should look like `domain → app → presentation`.
- Seeded deterministic combat, complete local data validation, idempotent battle rewards and atomic shop purchase.
- AI must be correctly named: Easy weighted choice; Normal expected-utility; Hard actual bounded 2-ply expectimax/minimax-like search rather than a function misleadingly named Minimax.
- Full 18×18 effectiveness, including **0 immunity**; correct dual type multiplicative behavior; no implicit fallback that converts an immunity to neutral.
- Moves drafted randomly **once** on creation using seeded legal pool with STAB and usability constraints; their four slots persist and do not reroll at the start of every battle.
- 16 Pokémon species and documented 61-move authored catalogue. Only implement clearly declared move-effect primitives; no unimplemented abilities/weather/trapping/field conditions.
- **Mandatory hybrid data pipeline:** Use PokéAPI v2 as the authoring-time reference for all 16 species' IDs, current types, six base stats, and move metadata. Build reproducible `scripts/import-pokeapi.mjs`; source records with provenance and pinned snapshot, and keep hand-authored gameplay data in separate override files. `scripts/validate-content.mjs` must catch invalid source/overrides, unsupported move effects, duplicate IDs and incomplete 18-type rules.
- **Never fetch PokeAPI during normal runtime** (including in battle, collection, shop or first-launch). Runtime reads local compiled JSON. Reimport is optional authoring; checked-in local catalogue must work offline from installed workspace.
- **Learnset discipline:** curated simulator pools may mix generations, and should be compared with PokeAPI version-group data. Flag noncanonical/custom allowances rather than claiming Generation-V canonical legality. Preserve four stable moves per owned instance and migrate old saves gracefully.
- **Art ingestion:** Prefer PokeAPI/sprites Gen-V front and back battle GIFs; convert available GIFs into PNG frame atlas+timings with a build-time script. Fall back to Gen-V static PNG, reviewed Showdown and deliberate silhouettes. Use only local verified paths at runtime. Do not assume Three.js automatically animates a GIF loaded as a Texture.
- **Source and rights provenance:** record source URLs, import date/version, sprites repository SHA and per-asset rights/shipping status. Pokémon sprite artwork remains copyrighted even if its repository is distributed under CC0.

## Art direction and scene quality
This should not look like a generic HTML page with two pictures. Compose a **beautiful 2.5D Pokémon-like battle** with proper near back-facing sprite / far front-facing sprite, 3D terrain, raised arena platforms, grounded shadows, gentle atmospheric depth, subtle camera choreography, and attractive independently animated elemental VFX. Make the main menu and shop visually designed as well.

Render sprites as world-space billboards with aspect-correct transparency, nearest-neighbor sampling, atlas-based idle frame animation with correct frame delays where available, and stable camera framing. Keep sprite readability independent of lighting and avoid postprocessing that smears pixels or creates flicker. Use Three.js and custom lightweight particles/shaders where useful. Create 3 complete arena presets (meadow, canyon, astral); add action choreography to attack, impact, effectiveness, status and faint.

Use HTML/CSS for HUD and menus: crisp fonts, type-specific colored accents, microinteractions, health bar animations, four move tiles (PP/type), XP, store purchase UI and polished result panel. Support 1920×1080 and 1280×720 well, gracefully compact at smaller widths, keyboard focus, reduced motion and Low VFX. Use Pixelify Sans (OFL) if convenient and ship license notices; do not copy game title logos or proprietary fonts.

Sound: user-gesture-unlocked, volume/mute. Prefer original synthesized SFX and original loops or properly licensed assets. No official Pokémon music rips.

## Asset policy
You may inspect Pokémon Database, PokéSprite, user-provided `src.rar`, PokéAPI and the PokeAPI/sprites repository to locate suitable art. **Do not imply these assets are copyright-free**. License-compliant, redistributable art is preferred. For missing/unclear rights, provide attractive original silhouettes/placeholder stand-ins and manifest entries that make replacement trivial. Distinguish private educational art choices from public-distribution rights. Create `ASSET_CREDITS.md` recording sources and rights; never hotlink production sprites or make play dependent on public APIs. If using user-provided sprite files, document their provenance and redistribution limitations rather than assuming ownership. Do not silently include third-party source code with unknown licenses.

## Required implementation order
1. Initialize vanilla Vite+Three.js project, working main menu, domain/app/render separation, local JSON readers and pinned package versions.
2. Implement PokeAPI import/normalization/override compiler, asset-selection + sprite GIF-to-atlas preprocessor, exact provenance metadata and validators; compile the 16-species/61-move curated ruleset. Avoid giant cloned asset repositories and any live API dependency in browser code.
3. Build the pure seeded battle engine and headless tests **before** coupling it to rendering.
4. Build one outstanding complete 1v1 battle vertical slice using Pikachu versus Squirtle or Charmander, correct front/back sprites, meaningful move VFX, HP/status events and reward-safe results. Visually reference `kkatsi`, but deliver an original and professional aesthetic.
5. Integrate starter choice, collection, challenge selection, store, levels/XP, coins, persistence, all curated species/moves, 3 AI levels and arena selection.
6. Polish 3 arenas, animated sprites and VFX/audio/UI responsiveness. Include reduced-motion/low-VFX modes and clear empty-asset fallbacks.
7. Run data-import tests, offline runtime checks, all domain tests, production build and browser smoke tests; inspect screenshots and fix defects; deliver complete runnable ZIP/repo with setup and rights docs.

## Mandatory test paths
- From clean save choose Pikachu, beat Squirtle using an effective Electric move, receive XP/coins, return to setup, buy a low-tier creature once affordable, refresh, confirm levels/coins/ownership remain correct.
- Attempt Electric attack on Ground and verify complete immunity (zero damage), and Fire vs Grass applies advantage.
- Validate four legal moves/PP, priority/speed, sleep/freeze/paralysis/burn/poison/confusion, misses/critical hits/KO and double-faint, statuses cleared between fights.
- Click buttons rapidly during attack and skip animation. Must never duplicate turns or rewards.
- Test store insufficient coin and duplicate purchase; tests must prove atomicity.
- With one invalid/missing sprite, still boot, fight and show safe fallback; verify animated atlas playback and correct front/back orientation on representative entries.
- Disconnect all external network access after `npm install`; local catalogue-driven menu, shop, battle and reload still work. Verify no `fetch("https://pokeapi.co...")` in browser entry modules.
- Reimport metadata with a deliberately incorrect move/learnset/source ID; validator must flag, rather than silently alter combat or erase current snapshots.
- Resize mid-battle; no visual clipping and no lost game state. Test Low VFX and Reduced Motion.
- Check browser console for errors and external network failures; verify offline runtime assets.

## Deliverables and completion reporting
Return a complete project ZIP or accessible repository including **actual runnable source files** and assets appropriate to rights, `package-lock.json`, README with WebStorm setup (`npm install`, `npm run dev`, `npm run build`), importer/validation command examples and source pinning, tests, design docs, `ASSET_CREDITS.md`, and clear screenshots/short QA report where possible. Do not merely dump pasted source in a chat message. Do not create empty placeholder directories marked as complete. If some copyrighted art cannot be distributed, ship clearly identified original stand-ins and an easy replacement workflow. State exactly which parts are implemented, which are deferred, how to run the game, any rights restrictions, and whether build/tests passed.

Do not pause after the architectural skeleton to ask permission to keep going: execute the complete agreed v1 scope, while making incremental compile-safe checkpoints. Preserve responsive UI and maintainability; avoid needless abstractions and overengineering.

---
