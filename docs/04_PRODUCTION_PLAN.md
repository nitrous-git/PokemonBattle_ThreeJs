# 04 — Production Plan & Acceptance Gates
**Delivery model:** Astra/Work builds complete application in a local workspace, tests between milestones, and returns a runnable repository/archive, not just code snippets. Phases are ordering/acceptance gates, not requests to ask for user approval after every class. Commit or checkpoint after each phase if Git repo available.

## Phase 0 — Bootstrap + source-content integration
Deliver Vite/vanilla JS, Three.js canvas, foundational DOM overlay, CSS tokens, screen router, package scripts, explicit Pokémon data importer/cache, reviewed overrides, generated local 16-species source snapshot, sprite prep strategy/manifest and rights records. Keep the network for **import only**; `npm run dev`, build and browser runtime must not require PokéAPI, GitHub or sprite CDN.

**Gate 0A — source ingestion:** `npm run data:import` (or documented equivalent) normalizes PokeAPI resources and persists a pinned source manifest; import is rerunnable, handles rate limits/offline update gracefully and logs unsupported or noncanonical curated learnset entries.

**Gate 0B — sprite readiness:** preflight art availability; process Gen-V GIF into playable atlas+timings for two sample species or record explicit static fallbacks; all 16 species have explicit front/back/icon manifest entries with provenance statuses. `npm run data:validate` and `npm run assets:check` succeed.

**Gate 0C — app:** `npm install`, `npm run dev`, `npm run build`, `npm run test` pass; menu visibly animated; no required remote runtime dependency; private asset binaries are not silently copied.

## Phase 1 — Battle domain core
Deliver compiled local PokeAPI-backed data repositories, authored 61-move rule overrides, complete 18-type chart, verified curated move pools, seeded random, stats/damage/status/PP/turn order and deterministic pure event-driven battle engine; AI Easy/Normal and true Hard search. Acceptance: unit suite green, immunity and four-move rules pass, sample match can finish headlessly without a DOM.

## Phase 2 — Vertical slice: one complete battle
Deliver selected starter and opponent, full world-space battlefield, correct front/back Gen-V-oriented sprites/fallbacks, animated atlas playback where available, move HUD, health/PP/status, animation queue, 3 class effects, result page. Acceptance: choice → fight → win/loss → menu; no orphan VFX, duplicate resolution or unclickable state; rendering does not change damage.

## Phase 3 — Complete product loop
Deliver intro, first-run starter choice, collection, opponent selection, shop, currency, XP/levels, save/load, 16 entries, price tiers, results/replay, duplicate-proof wallet. Acceptance: first launch; win; purchase; refresh; owned and level persist; loser can still progress.

## Phase 4 — Art and FX polish
Deliver 3 arenas, coherent UI visual design following `kkatsi` battle readability, additional VFX presets, type flashes, hit reactions, camera beats, smooth bars, audio cues/music where rights permit, responsive layout. Acceptance: 16 species art slots complete (real licensed assets or placeholders clearly identified), every move maps to an effective visual preset, Reduced Motion/Low VFX work, no ugly clipping at 1280×720 or 1920×1080.

## Phase 5 — Balance and QA
Deliver runtime diagnostics, AI tests, progression simulations, save migration tests, keyboard accessibility checks and browser smoke screenshots. Tweak move pools/reward formulas, ensure new Pokémon affordable quickly, cap engine work and VFX. Acceptance: `npm run build` and test suite green, complete repeatable scenario, no invalid actions or double grants, 55+ fps representative desktop (record environment), acceptable low graphics mode.

## Phase 6 — Handoff
Deliver fully runnable project ZIP/repository with README setup, credits/legal caveats, known limitations, short gameplay walkthrough or screenshots and a phase-by-phase completion report. The response must list exactly what is complete versus placeholders and what requires local user-added proprietary assets. User compiles via npm scripts in WebStorm.

## Import and asset build test matrix
| Case | Expected |
|---|---|
| Clean source import | All 16 Dex IDs resolve; six stats and 1–2 types normalize; every source object has provenance. |
| PokeAPI unavailable during app launch | Main menu, shop and complete battles remain playable with no remote HTTP requests. |
| PokeAPI unavailable during attempted reimport | Script reports useful error; last committed verified snapshot is retained, never partially overwritten. |
| Curated move absent from selected version-group learnset | Mark deliberate cross-generation/custom exception or replace move; never silently claim canonical legality. |
| PokeAPI null accuracy/power | Compiler handles null explicitly; rejects unsupported move logic instead of treating it as a guaranteed hit. |
| Type chart imported or changed | Frozen 18×18 local ruleset remains complete; zero immunities unchanged; differences require review. |
| Generated content reimport with same inputs | Semantically identical records and stable IDs; saves still resolve species/moves. |
| Gen-V animated front/back GIF | Atlases decoded to frame rectangles/durations; correct orientation, no GIF texture assumed. |
| Missing Gen-V back sprite | Reviewed source fallback or deliberate placeholder, logged in manifest. |
| Restricted sprite in public packaging mode | Distribution build omits/excludes restricted art and substitutes cleared placeholder, with clear report. |
| Assets loaded during battle | Only local Vite-served image/JSON resources; no external CDN dependency. |

## Mandatory test matrix
| Case | Expected |
|---|---|
| Electric move against Ground | 0 damage, `doesn't affect` message, no unintended status. |
| Dual type Electric vs Water/Flying | 4× multiplier. |
| Physical vs burned attacker | effective Attack halved. |
| Sleep two turns | Cannot act for exactly two attempts, then wakes per contract. |
| Frozen actor | Random thaw and same-turn action behavior as written. |
| Paralysis Speed and failure | Half speed, 25% full-para action failure. |
| Confusion + burn | Both coexist and tick with documented precedence. |
| Fast actor's opening KO | Slow actor never acts. |
| Priority vs speed | Priority wins. |
| Attack at zero PP | Not selectable; Struggle when all depleted. |
| Opponent move immune | Hard AI avoids move given viable alternative. |
| Exit/animation skip | No repeated turn or reward. |
| Store insufficient coins | No grant/deduction. |
| Purchase twice | v1 owned flag prevents duplicate. |
| Three won games then refresh | Coins, totalXP, levels and ownership unchanged after reload. |
| Corrupted saved JSON | Clear recovery path; no infinite loading screen. |
| No network | Game still runs once dependencies/assets installed and Vite serving. |
| Resizing at mid-turn | Fight state intact, camera/HUD adjusted. |
| Missing art file | Placeholder shown and loading does not deadlock. |

## Deferred optional v1.1
- Evolutions at thresholds, moves re-roll via in-game tutor, more opponents/biomes, trainer portraits, battle record/replay viewer, personal names/nicknames, team battles, custom difficulty presets, local save export/import and deployment with licensed original art.
