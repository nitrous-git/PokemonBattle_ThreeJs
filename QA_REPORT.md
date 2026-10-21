# QA / completion report

Build: Battle Atelier 1.0.0 — 2026-10-20

## Result

A runnable private educational WebStorm project is complete. The battle/progression loop, 16-species catalogue, 61 moves, 3 arenas, 3 AI levels, local persistence, data importer, animated sprite pipeline and build/validation commands are implemented.

## Executed checks

| Check | Result |
|---|---|
| `npm install` with pinned dependencies and lockfile | Passed on Node 24.19.0 |
| `npm run data:import` | Passed; 95 official pinned resources; atomic snapshot replacement |
| `npm run data:compile` / `data:validate` | Passed; 16 species, 61 moves, 324 type cells, 21 reviewed custom allowances |
| `npm run assets:prepare` | Passed; all 32 Gen-V front/back GIFs converted |
| `npm run assets:check` | Passed; local paths, frame rectangles, bounds, durations and provenance |
| `npm test` | **32 tests passed** in 3 files |
| `npm run lint` | Passed |
| `npm run build` | Passed; Three.js separated into its own bundle |
| `npm run test:browser` | Passed in headless Chromium 141 with SwiftShader |
| No external runtime network requests | Passed; external URLs were blocked during the entire browser flow |
| Browser console / uncaught errors | None during normal runtime |
| Missing sprite | Intentionally blocked Pikachu back atlas; original oriented stand-in rendered and fight remained interactive |
| Source immutability / invalid content | Wrong species ID, wrong move identity and unreviewed learnset changes rejected |
| Animated atlas fidelity | Pikachu/Charizard front/back frames checked for actual pixel variation, bounds and timing |

## Browser walkthrough actually exercised

1. Boot clean save, visit main menu at 1280×720 and 1920×1080.
2. Choose Pikachu; view all 16 opponents; enter battle with Squirtle.
3. Use an effective Electric move, rapidly click it three times, resize mid-playback and skip with Space.
4. Win; confirm reward/XP/level; reload; compare the entire persisted save to the pre-reload state.
5. Win a second battle; buy Bulbasaur with earned coins; reload and confirm two owned partners and correct deduction.
6. Confirm insufficient-funds purchase is disabled and owned species have no duplicate purchase action.
7. Visit collection and settings; enable Low VFX and Reduced Motion, enlarge UI, set playback speed.
8. Run a Hard battle in Canyon, abandon with confirmation; enter Astral with normal visual settings.
9. Resize to 390×844; check no horizontal overflow; view phone battle/setup.
10. Run isolated missing-back-sprite test and verify no uncaught application error.

Machine-readable results: `qa/browser-results.json`. Screenshots: `qa/01-menu-1280.png` through `qa/15-missing-sprite-fallback.png`.

Visual review found and corrected narrow-phone player clipping by widening the camera field of view. 1280×720 and 1920×1080 battle screenshots show readable front/back staging and complete controls.

## Domain coverage

- Full matrix size; Electric→Ground zero, Normal→Rock/Ghost zero, Fire→Grass, Electric→Water, Ice→Dragon/Flying 4×.
- Determinism and input immutability; four permanent legal/unique usable moves for all species over 100 seeds.
- Stats, burn penalty, critical-stage handling, priority, seeded speed ties, no action after KO.
- Sleep duration/wake order, freeze thaw behavior, paralysis block/speed, confusion coexistence/expiry, burn/poison residual draw, major-status/type immunities, secondary effects after KO.
- Misses/criticals, accuracy/evasion and always-hit exceptions, PP on blocked/missed/failed/immune attempts, Struggle/recoil and stage clamps.
- 60 headless seeded matches complete with legal actions and finite state; Hard selects coverage over immunity.
- Atomic purchases, insufficient funds, duplicate species rejection, reward idempotency, XP/leveling, JSON round-trip, fresh battle restoration, v0 migration, corrupt/unknown content rejection, quota rollback and stale-tab rejection.

## AI measurement

An additional fixed Pikachu-versus-Eevee simulation over 40 seeds per difficulty produced **15 opponent wins for Easy and 22 for Hard**. Hard decisions averaged **3.70 ms**, maximum **8.25 ms**, in this Node runtime. This is one regression matchup, not a general balance guarantee. Hard evaluates at most 272 transitions per decision and does not read the player's pending input.

## Art and deferred scope

- All 32 sprite orientations in the delivered private profile use actual animated Gen-V imagery; none are missing. These images are **copyright-restricted**, with source/rights records; they are not described as publicly cleared.
- `package:public` creates an independent original-stand-in source profile, excluding private screenshots and `dist/`.
- Arena geometry, effects, interface, geometric fallback art and synthesized audio are original. VFX use reusable typed treatments rather than 61 bespoke animations.
- Save export is implemented; save-import UI and mid-battle resume are deferred.
- No evolution, held items, abilities, party switching, overworld or multiplayer, consistent with the agreed v1 scope.

## Practical limits

Real Windows/WebStorm/GPU operation should be verified on the user's machine. No hardware 55+ FPS claim is made from a headless software-rendered browser. Firefox and Safari have not been tested. Phone controls are compact and the game remains desktop-first. No accessibility certification or long-term economy playtest is claimed. The original runtime does not use network APIs, but initial npm dependency installation and optional authoring reimports do.
