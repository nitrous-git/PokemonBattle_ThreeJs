# Curated Pokémon data and assets — authoring workflow

PokéAPI is an **authoring input**, not an in-game API. The shipped browser uses committed local JSON and files. Three.js itself is loaded from the pinned CDN; the `templates.html` fetch is same-origin.

## File ownership

| Path | Role |
|---|---|
| `src/data/game/speciesOverrides.json` | Curated species roster, Dex IDs, prices, sprite scales and custom-move exceptions |
| `src/data/game/movePools.json` | Per-species authored legal moves |
| `src/data/game/moveOverrides.json` | Supported moves: authored effects, VFX presets and reviewed source overrides |
| `src/data/game/economy.json` | Starting level/coins, tier level shifts and reward multipliers |
| `src/data/game/source-lock.json` | Pinned data/sprite source revisions and ruleset ID |
| `src/data/source/snapshot.json` | Large (~11.8 MB) raw imported source; do not load for unrelated feature work |
| `src/data/generated/{pokemon,moves,typeChart}.json` | Browser battle catalogue produced by compiler |
| `src/data/generated/spriteManifest.json` | Atlas/static image paths, frame timing, trims, scale, provenance and rights flags |
| `src/data/generated/{importManifest,learnsetAudit,overrideAudit}.json` | Provenance and audit artifacts |
| `public/assets/pokemon/` | Committed front/back atlas/static sprite images |
| `src/data/catalogue.js` | Imports compiled JSON into runtime |
| `src/domain/validation.js` | Compiler validation; current exact roster/move counts are 16 and 61 |

Current source lock: API-data `447bd5c378bf87da964bfe4dd7487a7bf1d97cbd`, sprite revision `97a7832d307311c0e1c6ea9035308bf80cc94f81`, ruleset `classic-modern-v1`. Read the actual lock file before editing revisions.

## Content commands (Node development tooling)

```sh
npm run data:import     # fetch/validate pinned source snapshot; can require network
npm run data:compile    # compile local curated content into generated JSON
npm run data:validate   # check source, overrides and generated freshness
npm run assets:prepare  # build sprite atlases and manifest; can require network
npm run assets:check    # validate image files and manifest records
npm run assets:standins # generate geometric placeholder artwork (authoring option)
```

These scripts are optional for running the already-built website, but required for reliable content updates. `scripts/io.mjs` is their shared helper. Asset generation uses Sharp (npm development dependency). No production build step is involved.

## Adding Pokémon or moves

1. Inspect existing authored override/pool schema and relevant `scripts/` functions. Do not edit generated catalogue files manually as a lasting change.
2. Add/modify curated species, pools, move metadata/effects with explicit source/provenance exceptions. When new source IDs are needed, import source data and review them before compiling. `data:import` replaces the snapshot only after source validation; review source-lock changes deliberately.
3. Compile and validate content. **Current `validateContent()` explicitly requires 16 species and 61 moves**: update these constraints, corresponding tests, and any fixed UI counts when expanding the roster. Keep 18 types unless a separately approved ruleset change warrants more.
4. Prepare/verify both front/back art, animated atlas frames, static previews and manifest entries. Keep original format/fallback semantics and repository-relative asset URLs.
5. Check balance, move pool legality, effects, PP, moveset drafting, purchases and existing save compatibility. Do not silently remove IDs used in player saves.
6. Run `npm run data:validate`, `npm run assets:check`, `npm run test`, and relevant manual/browser QA.

## Rules and legal boundary

Source stats/types and raw move metadata originate from pinned PokéAPI data. Actual combat effects, economy, balance and move pools are project-authored (including documented cross-generation/custom allowances). Do not silently conflate curated moves with cartridge-accurate learnsets.

Official Pokémon sprites, names and character art have third-party rights even when stored in the PokeAPI/sprites repository. **The current published build is not a grant of redistribution rights.** Record rights and provenance in `ASSET_CREDITS.md` and `spriteManifest.json`; use original/licensed replacements where appropriate. Keep `docs/POKEAPI_SPRITES_LICENCE.txt` and `public/THIRD_PARTY_NOTICES.txt` intact.
