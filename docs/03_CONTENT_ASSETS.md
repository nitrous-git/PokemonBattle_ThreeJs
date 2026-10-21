# 03 — Content, Battle Asset & UI Specification
## A. Content strategy
**Source of truth:** PokéAPI supplies National Dex identity, elemental types, base stats and raw move metadata. `PokeAPI/sprites` supplies potential sprite *sources*. Our game-owned config supplies balanced species prices, tiers, permitted move pools, 61 structured move effects, animation presets and art scale. Output is a validated local compiled catalogue. See `07_POKEAPI_DATA_PIPELINE.md`; do not make live remote calls from the browser.

**Visual target:** use `kkatsi/pokemon-battle` as the primary art direction reference: Gen-V front/back Pokémon battle sprites, readable HP panels and traditional battle composition, upgraded with Three.js world-space sprites, 3D terrain, authored VFX and original UI styling. Do not copy their React components or copyrighted UI assets verbatim.

A **curated launch roster of 16 species** is deliberate. Full Pokédex content is a production multiplier: missing front/back images, huge move/ability pools, and shallow VFX undermine polish. The engine and catalogue format must scale to 151+ species later, but the initial release must make the handpicked launch set feel finished.

Data records are indexed by immutable kebab-case `speciesId`, `moveId`, and `arenaId`. Never key save data on display names or sprite filenames. Names, types and base stat figures are reference content and should be manually validated against the chosen generation ruleset; our simulator deliberately uses *custom simplified mechanics* rather than claiming cartridge accuracy.

## B. Launch species
Columns stat: HP/Attack/Defense/SpecialAttack/SpecialDefense/Speed; `Free choice` species are offered in starter selection and shop for 300 coins if unchosen. Shop price editable via `economy.json`. Starter max level 50; newly bought creatures level 5.

| ID | Species | Type(s) | Base stats (HP/ATK/DEF/SpA/SpD/SPE) | Shop price | Tier |
|---|---|---|---|---:|---|
| 25 | Pikachu | Electric | 35/55/40/50/50/90 | 300 | Starter/Common |
| 1 | Bulbasaur | Grass/Poison | 45/49/49/65/65/45 | 300 | Starter/Common |
| 4 | Charmander | Fire | 39/52/43/60/50/65 | 300 | Starter/Common |
| 7 | Squirtle | Water | 44/48/65/50/64/43 | 300 | Starter/Common |
| 133 | Eevee | Normal | 55/55/50/45/65/55 | 320 | Common |
| 27 | Sandshrew | Ground | 50/75/85/20/30/40 | 350 | Common |
| 58 | Growlithe | Fire | 55/70/45/70/50/60 | 450 | Rare |
| 81 | Magnemite | Electric/Steel | 25/35/70/95/55/45 | 550 | Rare |
| 92 | Gastly | Ghost/Poison | 30/35/30/100/35/80 | 620 | Rare |
| 63 | Abra | Psychic | 25/20/15/105/55/90 | 650 | Rare |
| 74 | Geodude | Rock/Ground | 40/80/100/30/30/20 | 350 | Common |
| 54 | Psyduck | Water | 50/52/48/65/50/55 | 380 | Common |
| 66 | Machop | Fighting | 70/80/50/35/35/35 | 500 | Rare |
| 147 | Dratini | Dragon | 41/64/45/50/50/50 | 1100 | Premium |
| 6 | Charizard | Fire/Flying | 78/84/78/109/85/100 | 1500 | Premium |
| 9 | Blastoise | Water | 79/83/100/85/105/78 | 1450 | Premium |

**Important:** This is a *content target*, not permission to bundle official Pokémon art or branding. A developer can test privately with provided assets, but a distributable demo should use art with affirmative rights. All sprites need front, back, and 68×56-ish collection icon or a documented placeholder.

### Stable 4-move generation pools (8–10 per species) — curated simulator allowances, not claims of single-generation legality
These pools are examples to seed content JSON and may be adjusted when implemented for legality/balance, while preserving guarantees in `01_GAME_DESIGN.md`. One primary-type damaging STAB is mandatory, max two pure status moves after draft.

| Species | Curated permitted move pool — subject to source cross-check |
|---|---|
| Pikachu | thunder-shock, spark, thunderbolt, thunder-wave, quick-attack, tackle, tail-whip, growl, charge |
| Bulbasaur | vine-whip, razor-leaf, seed-bomb, poison-sting, poison-gas, sleep-powder, growth, tackle, growl |
| Charmander | ember, flame-wheel, fire-fang, flamethrower, scratch, swift, growl, tail-whip |
| Squirtle | water-gun, bubble-beam, aqua-tail, hydro-pump, withdraw, tackle, rapid-spin, tail-whip |
| Eevee | tackle, quick-attack, body-slam, swift, bite, growl, tail-whip, sand-attack |
| Sandshrew | mud-slap, bulldoze, earth-power, sand-attack, scratch, swift, rock-throw, harden |
| Growlithe | ember, flame-wheel, fire-fang, flamethrower, bite, crunch, quick-attack, growl, will-o-wisp |
| Magnemite | thunder-shock, spark, thunderbolt, thunder-wave, metal-claw, flash-cannon, charge, swift |
| Gastly | lick, shadow-ball, confuse-ray, hypnosis, smog, poison-gas, acid, psychic, swift |
| Abra | confusion, psybeam, psychic, calm-mind, hypnosis, swift, shadow-ball, charge |
| Geodude | rock-throw, rock-slide, rock-polish, bulldoze, mud-slap, tackle, harden, brick-break |
| Psyduck | water-gun, bubble-beam, hydro-pump, confusion, psybeam, scratch, swift, tail-whip |
| Machop | karate-chop, brick-break, bulk-up, tackle, body-slam, rock-throw, bulldoze, growl |
| Dratini | twister, dragon-breath, dragon-claw, thunder-wave, thunderbolt, aqua-tail, swift, growl |
| Charizard | ember, flamethrower, fire-fang, flame-wheel, gust, wing-attack, dragon-claw, scratch, will-o-wisp |
| Blastoise | water-gun, bubble-beam, hydro-pump, aqua-tail, withdraw, rapid-spin, ice-beam, body-slam |

`rapid-spin` and `scratch` must be implemented in catalogue below. Moves may be used by noncanonical species in this simplified game; if exact-generation move legality becomes a goal, regenerate learnsets as separate curated generation data. Do not accidentally gate starter moves by high levels in v1: selected move pool is the source of truth.

## C. Move catalogue — approximately 63 move IDs
**Legend:** `P` physical, `S` special, `T` status. Format `id: category, power, accuracy%, PP, effect`. All accuracy values apply only to hit check. `—` means no damage. All moves have explicit `vfxPreset` and `target`; a null accuracy means cannot miss. Move effects use registered enum primitives only.

### Normal
| Move ID | Category | Power | Acc | PP | Effect |
|---|---|---:|---:|---:|---|
| tackle | P | 40 | 100 | 35 | — |
| scratch | P | 40 | 100 | 35 | — |
| quick-attack | P | 40 | 100 | 30 | priority +1 |
| body-slam | P | 85 | 100 | 15 | 30% paralysis |
| swift | S | 60 | always | 20 | always-hit |
| rapid-spin | P | 50 | 100 | 40 | basic damage only (no hazard clearing v1) |
| growl | T | — | 100 | 40 | foe ATK −1 stage |
| tail-whip | T | — | 100 | 30 | foe DEF −1 stage |
| harden | T | — | always | 30 | self DEF +1 stage |

### Fire / Water / Grass
| Move ID | Type | Category | Power | Acc | PP | Effect |
|---|---|---|---:|---:|---:|---|
| ember | Fire | S | 40 | 100 | 25 | 10% burn |
| flame-wheel | Fire | P | 60 | 100 | 25 | 10% burn |
| fire-fang | Fire | P | 65 | 95 | 15 | 10% burn |
| flamethrower | Fire | S | 90 | 100 | 15 | 10% burn |
| will-o-wisp | Fire | T | — | 85 | 15 | burn foe |
| water-gun | Water | S | 40 | 100 | 25 | — |
| bubble-beam | Water | S | 65 | 100 | 20 | 10% foe Speed −1 |
| aqua-tail | Water | P | 90 | 90 | 10 | — |
| hydro-pump | Water | S | 110 | 80 | 5 | — |
| withdraw | Water | T | — | always | 40 | self DEF +1 |
| vine-whip | Grass | P | 45 | 100 | 25 | — |
| razor-leaf | Grass | P | 55 | 95 | 25 | crit 1/8 rather than 1/16 |
| seed-bomb | Grass | P | 80 | 100 | 15 | — |
| growth | Grass | T | — | always | 20 | self SpA +1 |
| sleep-powder | Grass | T | — | 75 | 15 | sleep foe |

### Electric / Ground / Rock
| Move ID | Type | Category | Power | Acc | PP | Effect |
|---|---|---|---:|---:|---:|---|
| thunder-shock | Electric | S | 40 | 100 | 30 | 10% paralysis |
| spark | Electric | P | 65 | 100 | 20 | 30% paralysis |
| thunderbolt | Electric | S | 90 | 100 | 15 | 10% paralysis |
| thunder-wave | Electric | T | — | 90 | 20 | paralysis foe; respects Electric→Ground immunity |
| charge | Electric | T | — | always | 20 | **custom simplified** self SpA +1 |
| mud-slap | Ground | S | 20 | 100 | 10 | foe Accuracy −1 |
| bulldoze | Ground | P | 60 | 100 | 20 | foe Speed −1 |
| earth-power | Ground | S | 90 | 100 | 10 | 10% foe SpD −1 |
| sand-attack | Ground | T | — | 100 | 15 | foe Accuracy −1 |
| rock-throw | Rock | P | 50 | 90 | 15 | — |
| rock-slide | Rock | P | 75 | 90 | 10 | 20% foe skipped-action/flinch? **Exclude flinch** in v1; basic damage only |
| rock-polish | Rock | T | — | always | 20 | self Speed +2 |

### Ghost / Psychic / Fighting
| Move ID | Type | Category | Power | Acc | PP | Effect |
|---|---|---|---:|---:|---:|---|
| lick | Ghost | P | 30 | 100 | 30 | 30% paralysis |
| shadow-ball | Ghost | S | 80 | 100 | 15 | 20% foe SpD −1 |
| confuse-ray | Ghost | T | — | always | 10 | confusion foe |
| confusion | Psychic | S | 50 | 100 | 25 | 10% confusion |
| psybeam | Psychic | S | 65 | 100 | 20 | 10% confusion |
| psychic | Psychic | S | 90 | 100 | 10 | 10% foe SpD −1 |
| calm-mind | Psychic | T | — | always | 20 | self SpA +1 and SpD +1 |
| hypnosis | Psychic | T | — | 60 | 20 | sleep foe |
| karate-chop | Fighting | P | 50 | 100 | 25 | crit 1/8 |
| brick-break | Fighting | P | 75 | 100 | 15 | basic damage only (no screens v1) |
| bulk-up | Fighting | T | — | always | 20 | self ATK +1, DEF +1 |

### Dragon / Steel / Poison / Dark / Flying / Ice
| Move ID | Type | Category | Power | Acc | PP | Effect |
|---|---|---|---:|---:|---:|---|
| twister | Dragon | S | 40 | 100 | 20 | basic damage only |
| dragon-breath | Dragon | S | 60 | 100 | 20 | 30% paralysis |
| dragon-claw | Dragon | P | 80 | 100 | 15 | — |
| metal-claw | Steel | P | 50 | 95 | 35 | 10% self ATK +1 |
| flash-cannon | Steel | S | 80 | 100 | 10 | 10% foe SpD −1 |
| poison-sting | Poison | P | 15 | 100 | 35 | 30% poison |
| smog | Poison | S | 30 | 70 | 20 | 40% poison |
| poison-gas | Poison | T | — | 90 | 40 | poison foe |
| acid | Poison | S | 40 | 100 | 30 | 10% foe SpD −1 |
| bite | Dark | P | 60 | 100 | 25 | basic damage only (no flinch v1) |
| crunch | Dark | P | 80 | 100 | 15 | 20% foe DEF −1 |
| gust | Flying | S | 40 | 100 | 35 | — |
| wing-attack | Flying | P | 60 | 100 | 35 | — |
| ice-beam | Ice | S | 90 | 100 | 10 | 10% freeze |

**Counts:** 9 Normal + 15 Fire/Water/Grass + 12 Electric/Ground/Rock + 11 Ghost/Psychic/Fighting + 14 remaining = **61 moves**. Check exact total in validator; documentation counts are descriptive, not logic. No external move effect parsing. All listed move IDs must exist in `moves.json`, valid effect types only. The 61-row balance table is the **authored v1 rule set**. Do not silently overwrite these values on re-import; reconcile PokeAPI values via explicit `moveOverrides.json` with provenance notes. Unknown/unsupported imported mechanics must not leak into v1.

### Status-type immunity clarification
- Burn fails on Fire-type target; Freeze fails on Ice-type target; Poison fails on Poison/Steel; Paralysis fails on Electric; type immunity rules additionally apply to **explicitly flagged** attacks such as Thunder Wave against Ground. Offensive damaging moves use the full chart. Neutral debuffs such as Growl don't accidentally inherit Normal→Ghost damage immunity unless a specific `immunityRule` is set.
- Stat stages clamped −6..+6. When an attempted stage move cannot change any stage, report `But it failed!`, PP still used.
- Multi-effect combos apply atomically in registered order. No flinch, trapping, entry hazards, weather, leech seed, fixed HP attacks, healing moves, ability triggers, shields or field traps in v1.

## D. Asset manifest and sources — authoritative v2
**Preferred source:** [PokeAPI/sprites](https://github.com/PokeAPI/sprites). Copy or transform only the curated launch roster; do not vendor the whole giant repository. All game-path lookup goes through an explicit local `spriteManifest.json`, never a presumed remote URL.

**Front/back art fallback order, per species and independently per orientation:**
1. **Gen-V Black/White animated:** `sprites/pokemon/versions/generation-v/black-white/animated/{dexId}.gif` and `animated/back/{dexId}.gif`.
2. **Gen-V Black/White static:** `sprites/pokemon/versions/generation-v/black-white/{dexId}.png` and `black-white/back/{dexId}.png`.
3. **Reviewed Showdown art:** `sprites/pokemon/other/showdown/{dexId}.gif` and `other/showdown/back/{dexId}.gif` if style-compatible and rights treatment approved.
4. **Purpose-built neutral placeholders** with front/back silhouette orientation; never silently mirror an opponent front sprite into a back sprite.

These paths are relative to the PokeAPI/sprites repository root; **verify availability individually**. Not every species/form has every animation or asset. Sprite fallback should be a source choice pinned in the manifest, not speculative file existence logic in rendering code.

**Spritesheet output contract (build-time):** use a documented Node-based GIF import/conversion utility (for example `sharp` with verified animation-frame support, or another explicit dependency) to produce transparent PNG atlases plus JSON frame rectangles/UVs and duration milliseconds. Preserve source frame timing, alpha, frame disposal/blending and edge padding; test against e.g. Pikachu front/back and Charizard front/back. Renderer consumes PNG atlas and JSON, never a GIF via ordinary `TextureLoader`. If a GIF cannot be decoded with the chosen tool, use a verified static PNG and record the fallback reason. Atlas creation is optional for icons/portraits, which can remain PNG.

**Each launch species must have:**
- `battle.front`: local static PNG fallback and optional atlas metadata;
- `battle.back`: local static PNG fallback and optional atlas metadata;
- `icon`: local PNG icon (PokeAPI Gen V icon when available, otherwise reviewed PokeSprite or generated neutral icon);
- `portrait`: local high-resolution official-artwork style asset only when allowed for the intended distribution, otherwise appropriately licensed or generated original replacement;
- `visualScale`, `baseAnchor`, `trimBounds`, `shadowRadius`, `pixelSampling`, `sourceCommit`, `sourceUrl`, `rightsStatus`, `redistributable` and fallback diagnostics.

**Render fidelity:** nearest-neighbor sampling on low-resolution battle sprites, sRGB color handling, alpha-correct transparent edges, no bloom on pixel sprites, correct camera-facing back/player and front/enemy presentation. Per-frame duration should remain consistent if tab sleeps or animation speed changes. No sprite atlas fetch is allowed from external URLs at runtime.

**Licensing:** [PokeAPI/sprites/LICENCE.txt](https://github.com/PokeAPI/sprites/blob/master/LICENCE.txt) says the repository is distributed under CC0 but **all image contents are copyright The Pokémon Company**. Repository distribution terms do not mean the repository can license someone else's artwork. A private educational prototype may use user-approved fan-game imagery subject to rights considerations, but public redistributable builds must separately resolve rights or use original replaceable stand-ins. The pack includes no Pokémon art. Each asset has a status field `copyrighted-restricted | cleared | placeholder | unknown`; unknown is not relabeled free. Assets from the user's Java archive and markpascua repo likewise require provenance review.

**Other references:**
- [Pokémon Database sprites](https://pokemondb.net/sprites) — comparison and reference; not an art sublicense.
- [PokéSprite](https://github.com/msikma/pokesprite) — icon design reference and optional reviewed asset source.
- [kkatsi Pokémon Battle](https://github.com/kkatsi/pokemon-battle) — **primary visual composition/interaction reference**, not a code/asset bulk-copy target.
- [Kermalis engine](https://github.com/Kermalis/PokemonBattleEngine) — detailed Gen-V battle rule behavior reference only.

**Provenance record:** `ASSET_CREDITS.md` and structured `spriteManifest.json` record species/form, source Git SHA, repository path/URL, transforms, rights status, attribution, and whether that specific asset may be shipped publicly. This is mandatory even for beautiful/complete private demo imagery.

## E. Arena content
| arenaId | Style | 3D elements | FX / mood |
|---|---|---|---|
| meadow | Bright meadow / handheld classic | Disc-shaped grass battle pads, curved terrain, distant low-poly trees, layered hills | Light fog, drifting pollen, soft cyan sky |
| canyon | Warm stone and orange dusk | Sandstone rings, rocks, distant cliff silhouettes | Dust motes, amber sky, long shadows |
| astral | Indigo magical chamber | Floating circular platforms, arcane floor markings, distant monoliths | Sparse stars, purple fog, subtle magical wisps |

Each arena has authored color grading and lighting; sprite legibility mandatory. World platforms imply perspective but keep both sprites readable and correctly vertically staggered. Camera shots: idle midwide, player-action pulse, enemy-action pulse, KO emphasis, victory pullback. Avoid camera orbits around billboard sprites.

## F. Move animation preset mapping
`physical-lunge` (normal/fighting/dark), `slash-claw` (scratch/dragon-claw/metal-claw), `projectile-fire`, `projectile-water`, `projectile-electric`, `projectile-grass`, `projectile-psychic`, `projectile-shadow`, `impact-earth`, `impact-rock`, `projectile-ice`, `status-self-buff`, `status-debuff`, `status-sleep`, `status-freeze`, `status-poison`, `status-paralysis`, `status-confusion`, `faint`, `level-up`. Choose at least 10 visually distinct implementations in phase 4. Particle palette keyed by type; no hand-written animation class per move.

Critical effect choreography contract: attack move announces → windup → class/type VFX → hit/miss → defender reaction → HP bar interpolation → status/effectiveness text → return idle. In reduced motion, replace camera shakes and projectile travel with quick fades/particle flashes but preserve feedback. Skip resolves visuals, not combat.

## G. UI visual content
- Branding: original title lockup inspired by retro battle games; **do not copy actual Pokémon logos**.
- Main menu: cinematic canvas with clean nav cards, small description and profile balance.
- Setup: premium card grid with type color rails, clean VS composition, controls aligned bottom.
- Collection: compact icon grid with type filters, detail panel, level XP strip and move icons.
- Store: catalogue card, price and Owned state, coin wallet, confirmation modal, purchase toast.
- Battle: HP/name/level/status chip panels, four 2×2 move tiles with PP/type, bottom narration stripe; opponent silhouette never overlays UI.
- Results: win/loss screen, XP and coin counters, level-up effect, continuation CTAs.
- Colors: muted warm parchment/cream text on navy charcoal UI, vivid *type-coded* accent colors, natural world hues, soft gold interactive highlights. Pixelify Sans (SIL OFL) for retro display; use readable body font, avoid all-caps paragraph text.
- Content copy: original explanatory text. Avoid reproducing long exact in-game Pokémon dialogue from copyrighted games.

## H. Audio specification
Generate original SFX with Web Audio primitives where feasible, or include verified CC0 samples with attributions. Required: UI hover, select, back, purchase, start/versus stinger, physical hit, elemental hit (fire, water, electric, psychic), status, health-critical pulse, faint, victory, defeat, coin reward, level up. Three optional short loops: menu ambient, battle rhythm, results/short stinger. User gesture unlocks sound, mute and volume persist. Never bundle copyrighted Pokémon OST or console sound rips.

## I. Content acceptance checklist
- Exactly 16 launch species; all have unique IDs, 1–2 valid PokeAPI-backed types/base stats and explicit imported provenance, local art manifest, tier/price, ≥8 curated *permitted* moves.
- Every curated pool references a registered imported move; compatibility is audited by PokeAPI learnsets, with per-entry intentional cross-generation/custom exceptions flagged, not silently asserted as canonical. Each compiled move has valid type/category/PP/accuracy/effects and VFX preset.
- At least four usable unique drafted moves per individual, with STAB move guarantee.
- 18×18 effectiveness matrix complete, finite and in {0,0.25,0.5,1,2} per atomic cell (dual combinations may be 4).
- Three arena IDs and background palettes; each runs in reduced-motion and Low VFX.
- All 16 front/back sprite entries have confirmed asset or deliberate fallback; GIF conversion, frame timing and UV playback tested on at least two animated species.
- Source snapshot records import date/endpoint and PokeAPI/sprites SHA; run import twice and obtain logically identical compiled content, excluding timestamp bookkeeping.
- Missing copyrighted images result in deliberate placeholders with user guidance, not black rectangles or broken controls.
