# 02 — Software Architecture & Contracts
## A. Technology strategy
- Language: **vanilla JavaScript, ES2022+ modules**, JSDoc typedefs for contracts and IDE hints; no React, Vue, TS, or global-script spaghetti.
- Package/build: **Vite vanilla template**, npm package lock; Three.js pinned to tested release in `package.json`; WebStorm opens repo directly. `npm install`, `npm run dev`, `npm run build`, `npm run preview`, `npm run test`, `npm run lint` must work.
- Graphics: Three.js (`WebGLRenderer`, `Scene`, `PerspectiveCamera`, `Sprite`/`SpriteMaterial` or camera-facing planes, local shaders only for quality-critical effects). `EffectComposer` bloom only on particles when safe and measured; no bloom on pixel art or HUD. Lightweight fog, instanced grass/rocks, radial gradients, grounded shadow decals. Do not require WebGPU.
- UI: vanilla DOM constructed from templates/components; CSS modules/files with BEM-like naming and design tokens. Battle HUD overlaid HTML, not bitmap canvas text, for crisp text and accessibility.
- Audio: simple Web Audio mixer or small original samples; no compulsory heavy audio library.
- Data: **PokeAPI-powered import pipeline is mandatory** for source-backed species/move/type data; importer is a development/build-time Node script only, never a browser/runtime dependency. Generated, normalized JSON plus authored overrides become the shipped game catalogue. Persist via `localStorage` schema `saveVersion=1`.
- Tests: Vitest for pure domain; optionally Playwright smoke tests if available; browser/manual QA checklist independent of external API.

## B. One-way dependency rule
`PokeAPI/sprites (authoring only) → import scripts + reviewed overrides → generated local content → domain battle rules + progression → application/services → presentation (DOM + Three.js + audio)`

The domain MAY import pure constants and local content; it MUST NOT import Three.js, DOM, CSS, audio, timers, GSAP, network/fetch, or `localStorage`. Import scripts may use HTTP/network, but they NEVER run when opening the game. Presentation MAY observe events but MUST NOT mutate battle HP, PP, status or currency directly. Progression listens only for authenticated domain completion results, not VFX completion signals.

No circular dependencies. One `GameApp` composition root creates all controllers and orchestrates scene transitions.

## C. Suggested file layout (authoritative v2 layout)
```text
pokemon-battle-clone/
  index.html
  package.json
  package-lock.json
  vite.config.js
  README.md
  ASSET_CREDITS.md
  LICENSES.md
  docs/{GAME_DESIGN,ARCHITECTURE,CONTENT_ASSETS,PRODUCTION_PLAN,DATA_PIPELINE}.md
  public/assets/
    pokemon/
      battle/{front,back}/<dexId>_static.png
      atlases/<dexId>_<front|back>.png
      portraits/<dexId>.png
      icons/<dexId>.png
      placeholders/{front,back,icon}.png
    arenas/{meadow,canyon,astral}/
    textures/{terrain,sky,fx}/
    audio/{music,sfx}/
    fonts/
  src/
    main.js
    app/{GameApp,AppState,ScreenRouter,EventBus,SettingsController}.js
    data/
      generated/{pokemon,moves,typeChart,importManifest,spriteManifest}.json
      game/{speciesOverrides,moveOverrides,movePools,economy,arenas,vfxPresets}.json
      repositories/{PokemonRepository,MoveRepository,TypeRepository}.js
    domain/
      battle/{BattleEngine,BattleFactory,TurnResolver,MoveResolver,DamageCalculator,
              StatusSystem,TypeSystem,AIController,SeededRNG,BattleEvents}.js
      progression/{CollectionSystem,ExperienceSystem,ShopSystem,RewardSystem}.js
      validation/{ContentValidator,SaveValidator}.js
    services/{SaveService,AssetLoader,AudioService}.js
    render/{RendererHost,SceneManager,ArenaScene,ArenaFactory,SpriteActor,
            SpriteAnimator,CameraDirector,VFXDirector,VFXPool,AnimationTimeline}.js
    ui/
      UIManager.js
      screens/{MainMenu,BattleSetup,Collection,Shop,BattleUI,Results,Settings}.js
      components/{PokemonCard,TypeChip,HealthPanel,MoveButton,DialogBox,Modal}.js
    styles/{tokens,base,layout,screens,battle,effects}.css
  scripts/
    import-pokeapi.mjs
    prepare-sprites.mjs
    validate-content.mjs
    check-assets.mjs
  tests/
    data/{importNormalization,overrideResolution,learnsetPolicy,spriteManifest}.test.js
    domain/{damage,typeChart,status,turnOrder,ai,progression}.test.js
    integration/{battleLifecycle,saveLoad,shopTransactions,offlineRuntime}.test.js
```
The source's `game/` and `generated/` directories have **different ownership**: generated files must not be hand-edited; reviewed gameplay decisions must not be overwritten by re-import. Do not download or commit the entire oversized PokeAPI sprite repository merely to use 16 species. Keep the production bundle curated.

## D. Component ownership
| Component | Owns | Never owns |
|---|---|---|
| `GameApp` | Instantiation, boot and teardown, route transition | Damage equations |
| `BattleFactory` | Initial snapshot, seed, generated opponent moves | Display assets |
| `DataImporter` (Node script) | Fetch source API resources, cache, normalize, preserve import provenance, apply strict contract | Combat resolution or browser fetch |
| `ContentCompiler` (Node script) | Resolve generated facts plus reviewed game overrides into validated catalogue | Editing source API snapshots by hand |
| `SpritePrep` (Node script) | Choose front/back sources, transform GIF frames into atlas+timeline, record rights | Browser-side GIF decode or remote fetch |
| `BattleEngine` | Authoritative match snapshot, command acceptance, event history | DOM, timing |
| `TurnResolver` | Order, actions, residual, terminal states | Animations |
| `MoveResolver` | Accuracy, PP, legal effects, status/state mutations via pure transitions | Scene graph |
| `DamageCalculator/TypeSystem` | Pure numbers/type chart | Save persistence |
| `StatusSystem` | Status ticks, application rules, duration | Particle effects |
| `AIController` | Legal enemy action choice from public/current state | User-selected pending action |
| `Collection/XP/Shop/Reward` | Save game ownership, wallet and experience transactions | UI clicks, canvas |
| `SaveService` | Serialization, migration, validation, atomic writes | Gameplay formulas |
| `ArenaScene/SpriteActor/SpriteAnimator` | WebGL object lifecycle, camera-facing static/atlas sprites, frame metadata and lights | HP mutations |
| `VFXDirector` | Interpret semantic events and play timelines | Who won |
| `UIManager/screens` | DOM and responsive interactions | Rule implementation |
| `AudioService` | Audio graph and cue playback | Battle phase progression |

## E. Data contracts — authoritative schemas
**PokemonSpecies (compiled)**: `id` kebab-case slug (e.g. `pikachu`), `dexNumber` integer (e.g. 25), `displayName`, `types` 1 or 2 valid IDs, `baseStats:{hp,attack,defense,spAttack,spDefense,speed}` positive integers from PokeAPI, `legalMoves[]` understood as **curated, v1-permitted** IDs (≥4, not an unqualified canonical version learnset), `rarity:common|rare|premium`, `priceCoins` nonnegative, `spriteKey`, `iconKey`, `visualScale` and `groundOffset`. Optional `flavorText`; `source:{provider,endpoint,importedAt}` or separate provenance manifest. Species records never contain current HP or owned flag.

**PokemonInstance** (persistent): `instanceId` UUID, `speciesId`, `level` (5..50), `totalXP`, `moveIds[4]`, `acquiredAt`, `variantSeed`. `totalXP >= level³` except when capped at 50. Runtime stats derived, not saved as mutable duplicates. `instanceId` allows eventual duplicates even though v1 UI disallows them.

**MoveDefinition (compiled)**: `id` (PokeAPI slug), `name`, `type`, `category:physical|special|status`, `power:number|null`, `accuracy:number|null`, `maxPP:int`, `priority:int(default 0)`, `target:self|opponent`, `effects:[{kind:damage|majorStatus|confusion|statStage|recoil; status?; chance?; stat?; stages?; recoilFraction?}]`, `vfxPreset`, `description`, and `sourceOverrides[]`. Power required for standard damage moves. No free-form/eval effects. **`accuracy:null` is not blindly interpreted as always-hit**: review/author explicit `alwaysHit` on applicable moves. PokeAPI English effect descriptions are display/reference text only, never executable code.

**TrainerSave**: `{saveVersion:1, revision:int, trainer:{coins,chosenStarterId}, collection:PokemonInstance[], settings:{...}, completedBattleIds:string[]}`. Completed IDs bounded to 100–300 most recent; replay uses new ID. Versioned migrations, unknown fields ignored, corrupt/unsafe data rejected and save-backup offered (do not silently reset). Prevent negative/NaN coins and duplicate IDs.

**BattleSnapshot**: `{battleId, seed, turn, phase, player:BattleActor, opponent:BattleActor, winner:null|'player'|'opponent'|'draw', rngState, nextEventSequence}`. `BattleActor` includes instance/species, `baseStats`, `currentHP,maxHP`, `statStages`, `majorStatus`, `statusDuration`, `confusionTurns`, `moves:[{moveId,currentPP,maxPP}]`, `fainted`. This is **not** automatically persisted each turn.

**BattleCommand**: `{actor:'player'|'opponent', kind:'move', slotIndex:0..3}` or internal `{kind:'struggle'}`. No direct arbitrary damage commands.

**BattleEvent**: `{battleId, seq, turn, type, actor, target, payload}`. Types include `BATTLE_STARTED`, `TURN_STARTED`, `MOVE_ANNOUNCED`, `MOVE_MISSED`, `MOVE_FAILED`, `VFX_REQUESTED`, `DAMAGE_APPLIED`, `HEALTH_CHANGED`, `STATUS_APPLIED`, `STATUS_CLEARED`, `STATUS_TICK`, `STAT_STAGE_CHANGED`, `PP_SPENT`, `CRITICAL_HIT`, `EFFECTIVENESS`, `FAINTED`, `BATTLE_ENDED`. Each event is **semantic** and can be rendered at different speeds. Damage event includes `beforeHP`, `afterHP`, `amount`, `effectiveness`; never just "hit" without details.

**BattleResult**: `{battleId, outcome, participatingInstanceId, opponentSpeciesId, opponentLevel, difficulty, tier, turnCount, xpAward, coinAward, finalSnapshotHash?}`. RewardSystem applies transaction exactly once. UI gets this immutable result.

### External content boundary and override precedence
`PokeAPI raw snapshot` → `normalized external facts` → `reviewed game overrides and move pools` → `validated compiled catalogue` → `domain repository`. Source API URLs and import date/commit are recorded in `importManifest.json`; every imported source move has a stable ID. Duplicate move names, missing Pokémon IDs, unknown stat names, nonfinite values, rejected move effects and unsafe overrides fail validation rather than producing runtime undefined behavior.

**Precedence:** manually reviewed simulator rules are authoritative for gameplay-specific behavior (shop/economy, move pools, v1 supported effects and visual mappings), PokeAPI is authoritative for source-backed base facts (Pokémon IDs/types/base stats and raw move metadata), and fallback placeholders are authoritative only for *rendering* when an art file is unavailable. Type effectiveness is imported/cross-checked but frozen into a 18×18 local chart for a chosen `rulesetId`, not fetched every match. A content update must not silently rewrite an individual's saved four moves.

`PokemonRepository` and `MoveRepository` are synchronous read-only adapters over static local JSON, returning validated definitions. They **do not** import fetch/HTTP clients or make PokeAPI requests.


## F. Gameplay command → presentation sequence
```text
User chooses move slot (DOM)
  → BattleScreen validates enabled state
  → BattleEngine.submitPlayerCommand(command)
  → AIController.selectCommand(snapshot, difficulty, seededRng)
  → BattleEngine.resolveTurn() [pure state transition]
  → returns {nextSnapshot, orderedEvents, optionalResult}
  → if optionalResult exists: RewardSystem.apply(result) exactly once + SaveService.write() immediately
  → PresentationQueue.enqueue(events) [strict sequential visual narration]
  → Arena/VFX/HUD/Audio play semantically keyed events
  → queue completes or skip fast-forwards, no model mutation
  → UI unlocks move buttons for next turn, OR Results displays already-committed outcome
```
Battle result transaction must happen promptly and atomically **independent of whether the user watched the VFX**. The on-screen sequence may reveal it afterward. Use `battleId`+`completionNonce` deduplication and guard replay/exit. Avoid double-resolving turn when user double-clicks. Reconcile current UI to authoritative snapshot after any skip or resize.

## G. RNG and tests
- Pure seeded PRNG (e.g., mulberry32 or xoshiro variant), fixed seed per battle, with explicitly segregated RNG from decorative VFX. The same initial battle/commands must yield byte-identical semantic events and results.
- Domain functions accept injected PRNG object; never call Math.random in battle mechanics or AI tie-breaks.
- Data normalization tests cover the exact six stat name mappings, one- and two-type species, version-tagged learnset references, API nullability, missing API resources, mismatched curated pools and selected art fallbacks.
- Unit tests cover all type chart entries, all move references, legal move drafting, dual-type multiplication, immunity 0, damage roll bounds, freeze/sleep/confusion end states, PP usage, burn/poison/recoil double-KO, speed ties, higher priority, no attack after KO, no duplicate rewards, shop atomicity, save migration and corrupted content.
- For AI, seed its decision process, assert it does not choose disabled moves, improves on a fixed matchup vs Easy over many seeds, and values immunity correctly.
- Integration smoke: boot save, choose starter, buy, select battle, play until end, return menu, refresh page, confirm persistence.

## H. Three.js architecture
1. A single renderer/canvas occupies the stable backdrop layer throughout navigation; use scene compositions or transition root groups to avoid destroying renderer on each route.
2. Menu scene = slowly rotating/hovering arena overview with safe, subtle particles. Battle scene = 3D terrain floor + 2 raised platforms + static/dynamic atmosphere + creature billboard actors.
3. `SpriteActor` loads front/back transparent art from a **local curated manifest**; `SpriteAnimator` advances atlas UV/frame indices from captured frame delays (animated frame sheets), with static PNG fallback. No reliance on Three.js directly decoding GIF animation as a texture. Scale inferred from cropped image/trim metadata and per-species override; bottom-center anchor and blob/contact shadow. Sprite colors remain unlit and crisp.
4. Pixel-art sampling uses `THREE.NearestFilter`, correct `SRGBColorSpace`, transparent treatment and preloaded textures; do not mix nearest-filter sprite art with blur/bloom processing. Large UI sprites can use CSS image-rendering: pixelated.
5. `CameraDirector` has stable composition presets per aspect ratio, small attack push-ins and smooth reset. Never rotate to an angle exposing the 'flat card' silhouette. Billboard faces camera while preserving foreground/background visual hierarchy.
6. `VFXDirector` maintains a small pooled set of particle/quads and reusable shader presets keyed by move category/type. Scene lighting never determines sprite readability. Keep postprocess optional and isolated; allow one-click Low VFX and Reduced Motion.
7. Timing uses requestAnimationFrame and clamped delta for decoration; move animations follow event-timeline duration and complete/cancel deterministically. All render targets/materials/listeners disposed appropriately on teardown.
8. Scene owns `resize(width,height,dpr)`, `update(delta)`, `dispose()`. Clamp devicePixelRatio to 1.5 (High) or 1.0 (Low) by config to protect performance. WebGL context-lost/restored handling.
9. CSS UI sits outside WebGL, with semantic HTML; health animations are CSS/JS driven from events. CSS variable design tokens make themes consistent.

## I. Responsive UI and design tokens
- 16:9 1920×1080 target; 1280×720 minimum full layout; at 1024 width switch to compact controls; prevent important buttons under browser chrome.
- CSS custom properties: `--bg-night`, `--panel`, `--panel-soft`, `--accent-gold`, `--accent-blue`, `--text`, `--muted`, `--outline`, `--font-display`, `--font-body`, `--radius`, `--shadow`, `--space-1..8`.
- Body typography Pixelify Sans (license-verified OFL) optionally paired with a neutral accessible interface font. Do not package fonts from game reference repos whose licenses are unknown.
- Components share hover/focus/active/disabled states and semantic button sizes. Use reduced-motion @media with settings override.
- No `window.alert`, no `document.querySelector` scattered through battle logic; screens own DOM tree.

## J. Asset-loading policy
- All local files referenced through `spriteManifest.json` with `id`, `front`, `back`, `icon`, animated atlas/frame timing metadata, provenance/rights flags and dimensions; no dynamically guessed URL paths in gameplay engine.
- Startup preload only menu/core HUD, selected starter icons and default arena. Deferred preload on setup of selected opponent's front, selected player's back and arena textures; progress indicator and fallback if unavailable.
- Files bundled with git where redistribution right exists; proprietary sprite art must be user-supplied and kept out of a public distro by default. Fallback silhouette/placeholder art means the project always boots.
- `prepare-sprites` selects art by explicit fallback ladder (Gen V animated → Gen V static → reviewed Showdown → neutral placeholder); exports playable atlas + frame metadata, validates frames/alpha/trim, and retains front/back orientation. `check-assets` validates manifest path existence, images, dimensions, missing pairs, licensing flags and disallowed external hotlinks; warnings sorted by species.
- No PokeAPI network fetch on opening a battle, collection or shop. No runtime sprite CDN hotlinks. Static JSON is pre-generated, provenance-pinned, reviewed and validated. Importer network access is optional **only when updating the catalogue**; normal `npm run dev/build/test` must work from committed content without contacting an external service.

## K. Saves and integrity
- SaveService commits immutable clone to `localStorage` under one namespaced key. Before mutation, read+validate; after mutation, increment revision and write; rollback visual action on storage quota exception while showing clear toast.
- Grant/purchase transactions have idempotency keys (e.g., battleId for reward). No possibility to award XP+coins twice by reopening Results. Lock purchases while writing.
- On first run, display starter selector; on corrupt save, offer backup export or reset with explicit user choice.
- Never serialize runtime three.js objects, DOM nodes, or frozen combat snapshots into trainer save.

## L. Risk register
| Risk | Mitigation |
|---|---|
| Art licenses / incomplete backs | Manifest and provenance audit, private demo vs distributable fallback art. |
| Too many mechanics | Curated 16 species, 50-ish validated moves, effect primitives, no special-case moves. |
| Fragile timing | Event replay and presentation queue separate from engine. |
| 'Minimax' AI misnomer | Actual bounded search tests; name heuristic properly. |
| Pixel art washed out by bloom | Isolated particle bloom, sprite-safe renderer and Low VFX baseline. |
| Reward duplication | Idempotent transaction keyed by battleId. |
| Save corruption / dev changes | Schema migration and validation. |
| WebStorm setup drift | Locked dependencies, documented npm scripts. |
| External API changes/limits | Import only during authoring, bounded concurrency/retries, cached snapshots, checked-in generated content. |
| Gen-V sprites missing/animated GIF unsupported | Explicit per-species sprite fallback and GIF-to-atlas build-time conversion, no runtime GIF decoding. |
| Curated moves mistaken for canonical legal learnsets | Audit by version group, mark intentional cross-gen/custom rules, fail on unknown IDs. |
| API value differs from authored v1 move balance | Reviewed override layer and full override/provenance report. |
