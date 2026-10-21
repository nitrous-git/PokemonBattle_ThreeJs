# Battle Atelier

A complete, local-first Pokémon battle simulator for **vanilla JavaScript + Three.js + Vite**, built for WebStorm. Working name: Pokémon Battle Clone. Original presentation: **Battle Atelier / Nitrous**.

## Start in WebStorm

1. Extract the ZIP and open the `pokemon-battle-clone` folder in WebStorm.
2. Install **Node.js 22.12+** (Node 24 was used for QA). Select it under WebStorm's Node.js interpreter settings.
3. Open WebStorm's terminal in the folder containing `package.json`:

```bash
npm install
npm run dev
```

4. Open the localhost URL printed by Vite, normally `http://127.0.0.1:5173`.

Do **not** double-click `index.html`; ES modules and local textures need the local server. No API keys, account or backend are needed. The included `package-lock.json` pins dependencies; `npm ci` is an alternative for an exact clean install. Internet is needed to install npm dependencies the first time. The installed game then needs only its local server.

## Play

- Begin your journey and choose Pikachu, Bulbasaur, Charmander or Squirtle. Start at level 5 with 200 coins.
- Select an opponent from all 16 species, a level tier, an AI difficulty and one of three arenas.
- Choose one of four moves. Moves are assigned once on acquisition and remain stable across battles and reloads.
- Win coins and XP, level your partner, and recruit more Pokémon in the shop. Defeat earns a small consolation.
- Every new match restores HP and PP and clears battle conditions. Abandoning a battle awards nothing.
- **1–4** select moves; **Space** skips the current turn's animation; **Escape** opens the leave-battle confirmation. All controls also support keyboard focus and mouse/touch.
- Settings include master volume/mute, original ambient music, Reduced Motion, Low VFX, UI scale, playback speed, save export and confirmed reset. Music is off by default and audio unlocks after a click.

## Implemented

- Main menu, starter selection, collection and stats, shop with confirmation, challenge setup, battle HUD/journal, results, settings and credits.
- 16 source-backed species, 61 authored moves, 18×18 modern type chart, dual types and exact immunities.
- Physical/special damage, STAB, discrete seeded variance, critical hits, accuracy/evasion, PP/Struggle, speed/priority/ties, stat stages, burn, poison, paralysis, sleep, freeze and confusion.
- Easy weighted AI, Normal utility AI and Hard bounded sampled two-turn minimax (up to 272 state transitions per decision).
- Cubic XP, levels 5–50, per-instance stable move drafts, permanent purchases and idempotent reward transactions.
- Three dimensional arenas: Verdant Meadow, Crimson Canyon and Astral Chamber. Actual Gen-V front/back animated sprites use **32 local PNG atlases** with source frame durations, plus static menu art.
- Type-tinted effects, physical lunges, hit flashes, faint fades, gentle camera response, synthesized sound cues and optional original generative ambient loop.
- Corrupt-save recovery/export, stale-tab protection, storage-failure rollback, missing-sprite stand-ins, context-loss overlay and resize-safe battle state.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local development server; no API calls |
| `npm run build` | Validate content/assets and create `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Domain, source, asset and integration tests |
| `npm run lint` | ESLint for application, scripts and tests |
| `npm run format` | Format JS and CSS using Prettier |
| `npm run data:import` | Optional: refresh source snapshot from pinned official PokéAPI mirror |
| `npm run data:compile` | Compile source facts + authored rules into local catalogue |
| `npm run data:validate` | Check source identities, learnsets, effects, types and generated freshness |
| `npm run assets:prepare` | Optional network: prepare the private Gen-V sprite profile |
| `npm run assets:standins` | Replace local Pokémon imagery with original geometric stand-ins |
| `npm run assets:check` | Validate local front/back atlas files, bounds, delays and provenance |
| `npm run package:public` | Create a separate source copy with stand-ins and no private screenshots |
| `npm run test:browser` | Smoke test the built game with Playwright |

For browser QA:

```bash
npm run build
npx playwright install chromium
npm run test:browser
```

`test:browser` starts its own local production server. It blocks all external requests, plays battles, buys a partner, verifies persistence, checks three arenas/settings/mobile layout and tests missing-art fallback. Results and screenshots go to `qa/`.

## Project structure

```text
src/
  domain/       Pure battle transitions, AI, RNG, rules, progression and validators
  data/
    source/     Pinned official PokéAPI resource snapshot, never runtime-loaded
    game/       Authored move effects, move pools, economy and source revision lock
    generated/  Compiled species, moves, type chart, audit and sprite manifests
  app/          GameApp: routing, commands, save transactions and event playback
  render/       Three.js scene, arenas, animated sprite actors and effect playback
  services/     Atomic save boundary and synthesized audio
  ui/           Reusable card, move and health panel templates
  styles/       Responsive layout and type palette
scripts/        Authoring pipeline, validators, browser QA and public-source packaging
tests/          Pure-domain, source normalization, persistence and asset tests
public/         Local sprite atlases/static art and original favicon
docs/           Supplied design pack plus implementation notes
qa/             Browser screenshots and machine-readable QA results
dist/           Ready-built private educational version (serve over HTTP)
```

The compact source layout merges several suggested single-purpose files where splitting would add indirection. The required ownership boundaries remain: domain has no DOM, Three.js, timers, storage or fetch. App owns commands and saves. Presentation plays immutable semantic events and never calculates battle outcomes.

## Data provenance and updates

`src/data/game/source-lock.json` pins:

- PokéAPI official `api-data` revision **447bd5c378bf87da964bfe4dd7487a7bf1d97cbd**.
- PokeAPI/sprites revision **97a7832d307311c0e1c6ea9035308bf80cc94f81**.
- Local ruleset **classic-modern-v1**.

The direct `pokeapi.co` endpoint was blocked in the build environment, so the delivered snapshot was imported from PokéAPI's own pinned v2 JSON repository. This is source-backed data, not manually invented stats. `importManifest.json` records the actual URLs, date and SHA-256 hashes. You can explicitly use the live API with `npm run data:import -- --live`; it remains an authoring action.

```bash
npm run data:import
npm run data:compile
npm run data:validate
```

Imports have at most four concurrent requests, bounded retries/timeouts, and preserve the old snapshot on failed fetch or validation. Unchanged source + overrides compile identically. A type-chart change is rejected for review instead of silently changing combat. To change source revisions, edit `source-lock.json` deliberately and review the resulting source/audit diff. Network import is never part of `dev` or `build`.

There are **21 intentional custom species/move allowances** from the supplied design. They are individually documented in `speciesOverrides.json` and `learnsetAudit.json`; the game does not claim Generation-V canonical learnsets. Imported move metadata and authored v1 differences appear in `overrideAudit.json`. Major statuses number **five**, with confusion as an additional volatile condition; the design's phrase “six major statuses” was a counting typo.

## Artwork profiles

This delivered build includes **copyright-restricted Pokémon sprites for the requested private educational fan-game workflow**. They are clearly flagged in the manifest and credits. They are not described as free or publicly cleared. No official logos, music or fonts are bundled.

For a source copy without the franchise artwork:

```bash
npm run package:public
```

Open `release/public-source`, run `npm install`, then `npm run build`. That copy contains original geometric front/back stand-ins. It excludes private screenshots, `dist/` and dependencies. Names and species data remain, so this is an art-substitution workflow, not a claim of blanket trademark clearance. See `ASSET_CREDITS.md` and `LICENSES.md`.

## Save behavior

Save key: `nitrous.battle-atelier.v1`. A validated save commits with a single LocalStorage write. Failed storage writes do not change the app's authoritative save. Revision mismatches prevent one open tab from silently overwriting another. Completed battle IDs prevent reward reapplication. Save v0 has a deterministic migration to v1; unknown species/moves trigger recovery rather than random reassignment. Export is supported; an in-app save-import UI is deferred.

Battles themselves are disposable and do not resume after reload. A resolved battle commits rewards **before** its remaining animations finish. Reloading mid-animation cannot award them again. If that write fails, the results screen provides retry saving; keep that tab open until it succeeds.

## QA and limits

See `QA_REPORT.md` and `qa/browser-results.json`. Screenshots cover 1280×720, 1920×1080 and 390×844. Automated browser testing used headless Chromium/SwiftShader on Linux; real Windows GPU frame rate, Firefox and Safari remain to be checked locally. The app is desktop-first, with a compact phone layout.

There are no abilities, evolution, held items, team switching, multiplayer, campaign or full cartridge-rule emulation. Hard AI approximates randomness with deterministic samples rather than exhaustively enumerating probabilities. Procedural arenas/effects are intentionally lightweight; this is a polished v1 fan simulator, not a production Pokémon engine.
