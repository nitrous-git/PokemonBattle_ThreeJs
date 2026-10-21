# 07 — PokeAPI Data Pipeline, Normalized Content & Sprite Processing
**Status:** Normative v2 technical appendix for the Astra implementation. **Scope:** authoring-time source acquisition, local snapshot compilation, sprite preparation and rights/provenance. This document does not grant artwork distribution rights.

## A. Architecture decision
**Hybrid, local-first design:** `PokéAPI → pinned import snapshots → source normalization → curated game overrides → fully validated compiled local JSON → synchronous game repositories`. PokeAPI and `PokeAPI/sprites` are **not** direct in-game runtime services. All gameplay—including first launch, shop, battle, rewards and loading a save—works without external internet once npm dependencies and local assets have been installed.

### Two kinds of data
- **External/source facts:** stable numeric Pokédex ID, canonical slug, type list/order, base stat numbers, raw PokeAPI move metadata, move-related version references. Pull from official v2 endpoints and record provenance.
- **Our game rules:** starter selection, curated allowed move pools, 61 supported v1 moves/effects, target and accuracy exceptions, type ruleset revision, AI, progression/XP, encounter level/difficulty, store prices and tier, sprite scaling, VFX preset. Human-authored override files own these values; reimport never destroys them.

## B. PokeAPI endpoints and mapping
**Endpoint base:** `https://pokeapi.co/api/v2/` (trailing slash optional to server, normalize URLs in importer). Documentation: <https://pokeapi.co/docs/v2>.

| Endpoint | Fields read | Normalized use |
|---|---|---|
| `/pokemon/{id}/` | `id`, `name`, `types[].type.name`, `stats[].stat.name`, `stats[].base_stat`, `moves[].move.name`, `moves[].version_group_details[]`, `sprites` | Identity, typings, six base stats, raw learnset candidates, art URL references |
| `/move/{id-or-name}/` | `id`, `name`, `type.name`, `damage_class.name`, `power`, `accuracy`, `pp`, `priority`, `target.name`, `effect_chance`, version/learned metadata | Source move metadata, mapped to reviewed v1 rule definition |
| `/type/{id-or-name}/` | `damage_relations` (and related generation-specific information if available) | Source comparison for versioned, local 18×18 effectiveness chart |
| `/pokemon-species/{id}/` | `growth_rate`, evolution chain reference, species ID | Provenance/future extension; v1 level progression is authored locally |
| `/growth-rate/{id}/` | experience curve | Reference-only/future, not silently adopted for v1 balance |

**IMPORTANT:** Version-group move data is nested and context-dependent; it is not a flat `pokemon.moves` list of always legal choices for level 5. Sprites metadata often points at URLs, missing/null slots and multiple version folders; do not trust any single URL without confirming local source availability.

**Normalization mapping:**
```
PokeAPI stat.name        game baseStats key
hp                       hp
attack                   attack
defense                  defense
special-attack           spAttack
special-defense          spDefense
speed                    speed
```
Reject duplicate stats, missing six-stats, non-integer/negative values, unknown types and mismatched Pokémon IDs. Preserve numeric `dexNumber`, slug `id` and stable move ID separately (never use display labels as keys). Pokemon abilities, held items and wild-game encounter mechanics can be ignored entirely in v1.

## C. Version-group and learnset compatibility
**Separate visual era from mechanical ruleset.** The game intentionally has Gen-V-looking animated art and a **modern 18-type chart**. These are independent. The game is not claiming Gen-V cartridge legality or complete canon accuracy.

**v1 learnset policy:** `curated-cross-generation`, based on user-authored per-species pools. At import time, parse each move's availability/learn method/version-group references, emit audit entries `{speciesId, moveId, observedVersionGroups[], supportedInSomeVersion, customExceptionReason?}`. For each curated pool move:
1. Ensure the move exists in imported PokeAPI move data and the local compiled v1 move catalogue.
2. If observed as learnable in *any* supported version, mark `source-backed` (not necessarily learnable at level 5 or through level-up).
3. If not observed, fail compilation unless `speciesOverrides.json` explicitly marks a `custom-allowed` exception with human-readable reason, or the pool is corrected.
4. If strict single-generation learnsets are wanted later, create a separate `learnsetPolicyId` and compile against an explicitly named `version_group` and `learn_method`/level; do NOT infer strictness from sprite era.

**Low-level combat:** 4 unique moves are seeded/drafted once when an instance is acquired; STAB damaging move guarantee, at least one move that can deal damage, one optional status, legal target and PP. Never randomize again on page refresh or per battle. Opponent draft is seeded per match. Move draft produces IDs only, and associated definitions are read from local repositories.

## D. Move metadata: do not infer game logic from prose
`/move/` supplies base metadata but **not a ready-made battle engine**. The API can return `null` for `power`/`accuracy`, and natural-language effect strings that may vary by language. Translate to compiled, explicit supported effects only via reviewed authored overrides. Never parse English effect strings with regex to decide damage/status.

**Move compilation order:**
1. Import source `id, name, type, damageClass, power, accuracy, pp, priority, target`.
2. Check the approved 61-move list (no surprise moves auto-enabled).
3. Apply `moveOverrides.json` with a documented reason for any deviation from source values or v1 simplifications.
4. Compile to move definition with `effects` array from a fixed enum: `DAMAGE`, `APPLY_MAJOR_STATUS`, `APPLY_CONFUSION`, `STAT_STAGE`, `RECOIL`. Extend enum only if defined and tested. `accuracy:null` is not automatically a guaranteed hit; set an explicit `alwaysHit:true` for supported exceptions such as Swift after verifying chosen rule.
5. Validate `category` vs power/effects/target, PP > 0, accuracy 1..100 or reviewed always-hit, optional effect probability 0..1, valid vfxPreset, and no unsupported move flags.

An authored special rule takes precedence for v1 even when source changes; preserve an `overrideReason`, `sourceValue` and `effectiveValue` in debug/audit reports. The compiled record contains only engine-consumable stable values.

## E. Type chart policy
Compile an **18×18** locally frozen effectiveness table for `rulesetId:'classic-modern-v1'`: Normal, Fire, Water, Electric, Grass, Ice, Fighting, Poison, Ground, Flying, Psychic, Bug, Rock, Ghost, Dragon, Dark, Steel, Fairy. PokeAPI `type` resources can be used as source input and for cross-checks; the project pins the evaluated matrix and tests key immunity and dual-type cases.

Every attacking×defending atomic cell must be numeric in `{0, 0.5, 1, 2}` (some other franchise variants differ, but v1 must be explicit); dual-type multiplication can yield `0, 0.25, 0.5, 1, 2, 4`. **Never filter/drop zero values**. If the API's current types are inconsistent with the selected ruleset revision, flag a human-reviewed diff rather than silently updating mechanics.

## F. Sprite selection and conversion
**Source:** <https://github.com/PokeAPI/sprites>. Relevant paths under repository root:
```
sprites/pokemon/versions/generation-v/black-white/animated/<dexId>.gif
sprites/pokemon/versions/generation-v/black-white/animated/back/<dexId>.gif
sprites/pokemon/versions/generation-v/black-white/<dexId>.png
sprites/pokemon/versions/generation-v/black-white/back/<dexId>.png
sprites/pokemon/other/showdown/<dexId>.gif
sprites/pokemon/other/showdown/back/<dexId>.gif
sprites/pokemon/other/official-artwork/<dexId>.png
```
Make no assumption that every file or variation exists. Pin source Git commit SHA and species/form ID. If no animated asset, use static before attempting a different era; prefer visual consistency within roster.

**Selection priority**: Gen-V GIF front/back → Gen-V static front/back → stylistically reviewed Showdown (optional) → neutral placeholder. Choose front and back independently but warn if they have incompatible styles. Explicitly preserve opponent front / player back orientation.

**Build-time sprite processing** (`scripts/prepare-sprites.mjs`):
- Read/download curated source art in development only. Do not clone 25GB+ of repository data or resolve art dynamically during match playback.
- For GIF source: decode all frames with an explicit Node-compatible image library; handle GIF disposal/transparency correctly, trim/normalize consistent frame box, add atlas padding to prevent texture bleeding, save PNG sprite atlas(s) and JSON frame data (`rectPx`, `uv`, `durationMs`, `anchorPx`). Verify real animation by comparing frame pixels; some assets may be technically animated but visually static.
- For static source: optimize RGBA PNG with measured bottom anchor/scale. Use high-res illustration for portrait only when rights handling is explicitly accepted.
- Store `front`,`back`,`icon`,`portrait` paths and per-frame sequence metadata under `src/data/generated/spriteManifest.json`. Asset paths are relative local URLs, no arbitrary external URL at runtime.
- Use a `SpriteAnimator` Three.js component to advance atlas UVs over time; support delta clamping and pause/resume when tab sleeps; set nearest filtering and SRGB color space; use unlit sprite materials to preserve pixel art. Do not rely on `THREE.TextureLoader` to animate GIF frames.
- Create per-art `rightsStatus` fields and keep restricted files out of the public distribution build (or substitute cleared replacements). If creating a private fan-game build with approved local image assets, tag private and keep the distinction explicit.

**Example sprite manifest shape (illustrative, not an asset itself):**
```json
{
  "speciesId": "pikachu",
  "dexNumber": 25,
  "front": {
    "staticUrl": "/assets/pokemon/battle/front/25_static.png",
    "atlasUrl": "/assets/pokemon/atlases/25_front.png",
    "frames": [{"rectPx":[0,0,96,96],"durationMs":100}],
    "anchor": [0.5,1.0], "pixelsPerUnit": 48
  },
  "back": {"staticUrl":"/assets/pokemon/battle/back/25_static.png"},
  "source": {"repo":"PokeAPI/sprites","revision":"<record real commit SHA>","path":"sprites/pokemon/versions/generation-v/black-white/animated/25.gif"},
  "rightsStatus": "copyrighted-restricted", "redistributable": false
}
```
**Example is not a claim that a particular frame is 96×96 or 100ms; extract true values.**

## G. Build scripts and exact acceptance conditions
Node npm scripts (names fixed; implementations may use supporting modules):
```
npm run data:import      # optional network; updates normalized imported source snapshots
npm run data:compile     # merges source facts + authored overrides, produces compiled local data
npm run data:validate    # strict referential, logic and learnset audit with diagnostics
npm run assets:prepare   # curated art and atlas processing, may use authoring network
npm run assets:check     # local sprite manifest/provenance completeness check
npm run dev              # Vite, MUST NOT require any API or sprite CDN
npm run build            # must succeed from committed local outputs, offline
npm run test             # deterministic domain + data + integration
npm run lint             # ordinary JS project quality
```
Do not make `data:import` or `assets:prepare` an implicit pre-dev/prebuild action. Document user-initiated update workflow separately. Concurrency should be bounded (e.g. <=4 HTTP requests), use bounded retries with backoff for transient 429/5xx/timeouts, follow reasonable published API etiquette, implement conditional cache if useful and fail safely without overwriting previously good snapshots.

**Persist provenance:** generated import manifest contains `pokeapiBaseURL`, `fetchedAtUTC`, `sourceSchemaVersion`, `rulesetId`, `pokemonIds[16]`, `moveIds[]`, `typeIds[18]`, `sourceHash` and `spriteRepoRevision`. Re-running compile on unchanged normalized source and overrides must produce **byte-identical semantic game data**, excluding bookkeeping timestamps in separate provenance files. Write outputs via temp files + rename to prevent partial corruption.

**Strict checks**:
- 16 species; all IDs/names unique and match source; six valid base stats; 1–2 types; existing store prices and tiers.
- All curated pools >=4 distinct registered, supported moves; log whether source-backed from some version; reject unknown IDs and missing custom exceptions.
- All 61 authored moves compile with structured effects and VFX preset; compare metadata import, note reviewed deviations.
- Exactly 18×18 valid type relationships; immune cases remain zero; no NaN/undefined or empty chart rows.
- All 16 species have front/back/icon entries and finite sizing/anchor metadata; real atlas frame bounds/delays valid. Missing art can resolve to explicit placeholder and produce a warning, not a broken object.
- Build reports per-art rights; a public/release packaging profile cannot silently include copyright-restricted Pokémon art as though cleared.
- Save migration works after imported data changes; missing species/moves are not silently replaced with random choices. Old IDs stable.
- A runtime smoke test intercepts `fetch/XMLHttpRequest` to outside origin: boot, setup, shop, match and reload must not require PokeAPI/CDN.

## H. Reference-specific engineering cautions
`kkatsi/pokemon-battle` is the **primary visual and UX precedent**; its React/RTK-Query code fetches Pokémon/moves live and mixes gameplay with asynchronous UI hooks. We will use its layout and pacing ideas, but **not** copy its runtime architecture. Its function `minmaxMoveDecision` is a damage-weighted randomized heuristic, not true Minimax. Its source also has a type effectiveness computation that filters out zero values; v1 must preserve immunities. Real hard-mode AI requires explicit bounded game-tree search, and gameplay damage must use the current Pokémon level rather than a fixed default level.

## I. Asset rights boundary
PokéAPI's project software/data terms and the sprites repository's CC0 declaration **do not give Pokémon character-art rights**. `PokeAPI/sprites/LICENCE.txt` says all image contents are copyright The Pokémon Company. Keep an `ASSET_CREDITS.md` manifest with author, origin URL, original rights notice, modification, intended use and distribution status for every image/audio/font. The implementation can be structured to accommodate user-supplied private sprites; a public portfolio deliverable needs a separate art/branding rights review or independent original art. Do not copy whole reference websites, fonts or Nintendo/Pokémon music files without rights.

## J. Design completion vs implementation completion
The accompanying `.md` pack is design/implementation instruction only. In the **Astra implementation pass**, completion requires a runnable WebStorm project, source, valid local catalogues and atlas/asset outputs subject to rights, tests, build, playable battle loop, collection/shop/progression, complete README, credits and a truthful report distinguishing finished art from placeholders. No architectural scaffolding alone is counted as a completed game.
