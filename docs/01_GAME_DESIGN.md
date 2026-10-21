# 01 — Game Design Document
## A. Vision and pillars
**Working title:** Pokémon Battle Clone (internal development name). A battle-first, replayable, visually polished fan/education experiment. The game should evoke handheld-era combat while feeling like a contemporary desktop browser game.

Pillars:
1. **Immediate play:** Boot → pick owned Pokémon → choose enemy → Battle, under 15 seconds after first run.
2. **Readable strategy:** Move type, category, power, accuracy, PP, potential effect, type advantage and status visible.
3. **Tactile combat:** Every turn has anticipation → readable action → hit/VFX → results, never a silent HP subtraction.
4. **Meaningful progression:** XP, levels, coins and unlocks persist; repeatable encounters remain useful without being exploitable.
5. **Professional implementation:** Pure deterministic mechanics, independent presentation, repeatable tests; PokeAPI is used only in a repeatable authoring-time import pipeline, never required at runtime.

## B. Scope
### v1 included
- Intro/presentation screen with Play, Collection, Shop, Settings, Credits.
- New-save starter choice: Pikachu/Bulbasaur/Charmander/Squirtle; one starter selected and permanently owned.
- Collection: owned roster, selected individual, level/XP/next level, stats/types/status-free between battles, four moves and PP metadata; authentic source-backed species metadata with authored game-balance overrides.
- Challenge setup: opponent catalogue, opponent preview, level selection via three fixed tiers, difficulty Easy/Normal/Hard, optional random opponent, Battle CTA; explicitly show coin/XP reward estimates.
- Battle arena: correct front/back sprite framing, world-space ground and platforms, 3D environment, atmosphere, fixed cinematic camera with small movement during attacks, 4-move command UI, HP/XP/status bars, scrolling narration, battle results.
- Rules: 1v1 turn-based; turn priority, speed and speed ties, accuracy and evasion handling, damaging/status moves, physical/special stats, 18-type effectiveness, dual types, STAB, crit, major statuses and confusion, PP, zero-HP faint, win/loss, XP/coins and levels.
- Shop: coin prices, owned/unowned state, purchase confirmation, save, preview.
- Quality: options for volume, reduced motion, reduced VFX, UI scale, mute, reset-save confirmation; responsive desktop-first layout; basic keyboard and ARIA focus; no console errors.

### Explicitly out of scope
Overworld and trainer movement, exploration, team switching, multiplayer/network, trading, breeding, capturing Pokémon, six-member parties, EV/IV customization, held items, evolutions, abilities, weather, terrain effects, multi-target moves, mega evolution, doubles, full canonical move learnsets, PvP rank ladders, accounts, cloud saves, microtransactions and an online economy. Architect future seams but do not prebuild them.

## C. Core progression loop
`Main Menu → Battle Setup (Owned Creature + Opponent + Tier + Difficulty) → Prebattle Entrance → Turn-Based Battle → Results (XP + Coins + Level Ups) → Collection or Shop → Repeat`

First boot → choose one of four starter Pokémon at level 5; receive 200 coins; starter's four moves generated from approved learnset and saved. Player can immediately battle any unlocked challenge; enemies are **not purchased** and can be previewed even when unowned. Winning awards XP to the participating owned individual and coins to trainer; buying creates a new owned individual at level 5, generating four moves. Losing awards a small consolation amount to prevent softlock. Finishing a match restores owned Pokémon to full HP/PP and clears battle statuses before next match (no consumable healing economy).

## D. Screen-by-screen UX
### D1. Splash / main menu
Canvas background shows an atmospheric 3D arena in soft focus with a subtly bobbing featured sprite and particles. Foreground contains original/unofficial title art, **Play Battle**, **Collection**, **Pokémon Shop**, **Settings**, **Credits**. Coins and save indicator appear in top right. Avoid using Nintendo/Pokémon's logos or official typeface as product branding.

### D2. Battle setup
Two deliberate columns: left **My Pokémon** cards (owned only, level and typing); right **Choose Opponent** list (all 16 species, tier badge/level) with large central VS preview. Lower row: opponent level tier `Rookie / Rival / Champion` (relative to player's selected level), AI `Easy / Normal / Hard`; Battle button. Show calculated suggested reward range and warning for overleveled matchups. Filter by name/type; disabled owned state never restricts opponents. One selected player and one opponent at a time. Build selection UX without loading a full arena again.

### D3. Collection
16-slot Pokédex-like gallery: owned entries show icon and growth; locked entries show silhouette and store CTA; selecting a card shows species art, dual types, level, HP/ATK/DEF/SpA/SpD/SPE, XP, and four permanent assigned moves. No direct manual level purchases in v1; level through battles. Show how each move behaves. Handle any number of owned individuals even if store initially enforces one of each species.

### D4. Shop
Curated Pokémon catalogue with pricing, icon and name, type chips, preview and Buy affordance. For v1, one owned individual per species; owned cards read `Owned`. Purchases are irreversible but safe: atomic balance check, ownership check, deduction and grant occur in one state update and persist together. Starting starter species count as already owned. No purchasable opponent unlock; store is the collection economy, not an opponent selector.

### D5. Combat arena
Target desktop aspect ratio 16:9, resilient to 16:10/4:3. Far opponent upper-right and near back-facing player lower-left on circular platforms; muted painted-looking environment and subtle dimensional depth. Opponent HUD upper-left, player HUD lower-right. Bottom quarter: battle command area. Main view `Fight` with exactly four move buttons (2×2), each showing name/type/remaining PP; Details area shows base power, accuracy, effect, type indicator. Narration strip remains visible; action buttons lock during resolution. Include speed toggle for narration/animation and optional skip animation (`Space` only when animating). Disable all buttons except controlled skip during event playback.

### D6. Results
Win/Loss banner, participating Pokémon, earned coins, XP progress animation, level-up summary if any, enemy fought, turn count, Replay (same encounter with a **new** battle seed), Change Opponent, Collection, Shop. Currency and XP granted **once** per completed battle, not per click. Distinct no-reward Abandon/Exit confirmation during combat.

## E. Battle rules — normative v1
**Battle identity:** single local snapshot with battleId, seed, participant speciesIds/instanceIds, level, maxHP/currentHP, base/current stat stages, status, confusionTurns, four moveIds and currentPP, turnNumber, phase and log. The battle snapshot is disposable; persistent collection never stores current combat HP/status/PP.

**Four-move drafting:** on acquisition, use seeded shuffling from curated learnset to produce four unique legal moves. Guarantee at least one STAB damaging move (if available), at least one additional damaging move, at most two pure status moves, and nonduplicate moves. If insufficient candidates, fill from documented compatible generic moves; never create an unusable attack set. Persist moveIds and their initial max PP with the Pokémon instance. Opponent draft occurs at battle construction; same seeded results throughout fight. Every move supports a declared effect schema and a visualization preset.

**Leveling:** species base stats drive six stats; starting level = 5; max level = 50 in v1; stats recalc after battle on level up; preserve fixed-percent HP only within a match (levels occur afterward). Starter level 5. Player levels and experience persist per owned individual. One exp curve (medium-fast cubic `totalXP(L)=L³`, with level-5 Pokémon starting at totalXP=125). XP totals increase with each battle until next threshold. Level 50 stores maxXP cap. Rewards tuned against curve (see below).

**Stat formulas** (normative simplification with fixed IV=15, EV=0, neutral nature):
- HP = floor(((2×baseHP + 15) × level)/100) + level + 10.
- Other five stats = floor(((2×baseStat + 15) × level)/100) + 5.
- Battle-only stat modifiers are stages −6..+6; positive stage multiplier `(2+stage)/2`; negative `(2)/(2−stage)`; speed from paralysis additional 0.5.
- No RNG from Math.random in domain functions; battle seeded RNG injected everywhere.

**Damage (simplified Gen-like, specified for our simulator, not exact cartridge):**
1. Reject damaging move if attack misses or target is immune.
2. Select Physical (Attack vs Defense) or Special (SpA vs SpD).
3. Base = `floor(floor((2×level/5 + 2) × power × effectiveAtk / effectiveDef) / 50) + 2`.
4. Multiply by STAB 1.5 if attack type belongs to attacker type set; by type effectiveness (0, 0.25, 0.5, 1, 2, 4), optional critical 1.5 (1/16 crit baseline) and seeded random factor from discrete [0.85, 1.0]. Floor final, clamp at least 1 **only if** effectiveness >0 and the move hits. Zero type effectiveness always means zero damage.
5. For damaging moves with secondary effects, roll effects only after hit, unless exception is explicitly declared; status-only effects respect accuracy/immunities/target.
6. Crit ignores negative attack stages and positive defense stages (if implemented; otherwise document and test chosen simplified rule). Implement no hidden variations from references.

**Move order:** priority (e.g. Quick Attack priority +1), then effective speed; exact speed tie resolved through seeded coin flip. Declare both commands before resolution. If first action KOs opponent, second does not act. PP is spent when attempting a move, even on a miss or blocked status (documented design choice); at 0 PP selection disabled. If all four are depleted, expose a universal Struggle fallback (typeless physical base 50, recoil quarter damage dealt, cannot be selected otherwise).

**Accuracy:** per-move percentage adjusted by accuracy/evasion stages; 100 means no miss absent modifiers; `accuracy: null` signifies always-hit. Accuracy roll before secondary status checks. Avoid duplicate independent hit rolls. Targets: self/enemy; explicit status targeting.

**Conditions:** allow one major status at a time (burn, paralysis, sleep, freeze, poison); confusion may coexist as volatile. On application, do not overwrite an existing major condition. Status-blocked move does not play impact VFX. Clear all between matches.

| Condition | v1 rule | Timing / feedback |
|---|---|---|
| Paralysis | 50% effective Speed and 25% chance to fail move | Check before action; yellow electric jitter, `PAR` badge. |
| Burn | Halve effective Physical Attack; deal `max(1, floor(maxHP/16))` at end of turn | Orange ember flecks, `BRN`. |
| Sleep | 1–3 full attempted turns asleep, predetermined from seeded RNG | Wake after counter reaches zero and act on next action; floating `Z`, `SLP`. |
| Freeze | Prevent move until 20% thaw check at start of each attempted action | Thawing permits acting same turn; ice tint/shatter, `FRZ`. |
| Confusion | Volatile duration 2–4 attempted turns; 1/3 chance to self-hit instead of selected move | Self-hit typeless fixed formula with 40 effective base power, no type/STAB; `CNF`. |
| Poison | At turn end deal `max(1, floor(maxHP/8))` | Purple pulse, `PSN`. |

**Turn resolution in order:** `AWAIT_SELECTION → LOCK_BOTH_ACTIONS → ORDER_ACTIONS → ACTION_1 (block, PP, accuracy, effect, KO) → ACTION_2 if both alive → END_OF_TURN_RESIDUAL (player then enemy, consistent) → FAINT_CHECK → NEXT_TURN or RESULTS`. At each significant transition, append an immutable semantic event. If both faint from residual/recoil, call Draw: consolation 10 coins, zero victory rewards, no XP. Never transition from ended battle back to playing. Do not permit replay/resume of a completed reward transaction.

**Buff/debuff moves:** For v1 support simple stat stage (+1 ATK, +1 DEF, +1 SpA, +1 Speed, −1 opponent ATK/DEF/Accuracy). Status moves declare structured effects; descriptions are display strings, **never parsed to infer mechanics**. Nonimplemented mechanic is rejected by content validation.

### Content and ruleset policy (v2)
PokéAPI is an authoritative *source of reference facts* about species IDs, forms, current type assignments, base stats, and move metadata; it is **not** an executable rule engine. The shipped game reads only `src/data/generated/*.json`, plus our own `src/data/game/*.json` override/catalogue files, validated at development/build time. The following are fixed:

- **Species data:** the 16 named launch species use stable National Dex IDs and normalized PokeAPI base stats/types. Do not fill missing API responses with made-up base stats. For a failed import, use the previously checked-in snapshot, display a warning, and fail validation if none exists.
- **Move rules:** base power, accuracy, PP, type, category and priority are imported where possible, then pinned/overridden to match the curated v1 catalogue. All executable statuses, stat stages, recoil, animation mapping and balance exceptions come from our explicit structured effects—not from English descriptions returned by an API.
- **Learnset policy:** the game's curated 4-move acquisition pools can mix moves learned across different Pokémon generations. Audit every move against PokéAPI's move/version-group references. Mark a true mismatch as an explicit **custom simulator exception**, or substitute a suitable supported move; never claim all pools are canonical Generation-V learnsets.
- **Battle level:** start at 5, cap at 50; gameplay level formula, XP curve, store pricing and opponent challenge scaling are our own authored mechanics.
- **Identity and reproducibility:** source IDs and exact imported snapshot versions remain stable across play sessions. Never re-roll an owned Pokémon's moves on browser refresh or API update. Existing local saves must remain readable after catalogue updates.


## F. Type effectiveness
Use the complete 18×18 attack-vs-defense table as authoritative local JSON. Dual types multiply. Range 0–4. Types: Normal, Fire, Water, Electric, Grass, Ice, Fighting, Poison, Ground, Flying, Psychic, Bug, Rock, Ghost, Dragon, Dark, Steel, Fairy. The full asset table and validator are part of Phase 1, not deferred. Examples that MUST pass: Electric→Water 2; Electric→Ground 0; Fire→Grass 2; Fire→Water 0.5; Normal→Ghost 0; Fighting→Normal 2; Normal→Rock/Ghost 0.5×0=0; Ice→Dragon/Flying 2×2=4. Never filter out zero multipliers. Empty/unknown types are invalid data, never treated as an unhandled `reduce()` case.

## G. AI design
AI always considers only its own legal moves and known current state (no cheating by reading the player's uncommitted command in Hard mode). At decision time, player and AI make choices without revealing one to the other. Easy = weighted random favoring reasonable damaging moves. Normal = one-turn action utility assessment including expected type-adjusted damage, status infliction chance, self-survival and PP. Hard = depth-2 expectimax/minimax-like search across both sides' available commands (bounded to <= 400 evaluated states), with probability branches sampled/approximated for accuracy, crit, status and speed. Evaluate post-turn state: HP ratio, KO likelihood, board status/stages, move PP, tempo. Hard may prefer paralysis/defense when it improves outcome, should switch to coverage move on immunity. Use seeded tie-breaker/noisy variety so it feels strategic without becoming deterministic or flawless. Run AI computation without DOM/Three.js; if computation cost exceeds 15ms on desktop, simplify branches. Naming must match implementation: call heuristic `UtilityAI`, actual tree-based search `ExpectimaxAI`.

## H. Economy and difficulty
- Starter choice grants exactly one free Pokémon; balance starts at 200 coins.
- All 16 opponent species are available as challenge choices immediately. Enemy difficulty tier is level-relative: Rookie = selected player's level−1 (min 3); Rival = equal level; Champion = level+2 (max 50). Each tier modifies reward coefficient (0.8,1,1.4), with AI difficulty coefficient (Easy 0.9, Normal 1, Hard 1.15).
- Win coins: `round((30 + enemyLevel × 8) × tierMultiplier × aiMultiplier)`. Same-opponent farming is acceptable as core gameplay, but no first-win inflation needed.
- Loss: 10 coins; draw 10 coins; Abandon: 0. Coins clamp to >=0 and transactions idempotent.
- Winner XP: `round((45 + enemyLevel × 15) × tierMultiplier)`, capped 1–2 levels per match only if necessary after playtest (prefer formula tuning instead of hidden cap). Loss XP=20% of win XP; Draw XP=0. XP never awarded twice.
- Price tiers proposed: Common 250–450, Rare 600–900, Premium 1100–1600 (see content spec). Owned Pokémon purchased once per species in v1. Starter exception prevents expensive early grind; a Common can be obtained within 1–3 wins.
- A newly purchased Pokémon is level 5 with fully initialized XP, moves and stats; free starters are excluded from shop if already owned.
- Results must show transparent earned XP/coins and potential next unlock. Balance these values empirically in Phase 5; constants live in JSON config, not scattered in UI.

## I. Presentation/feedback design
- Sprite pixel art uses `NearestFilter` and proper transparency, correct aspect ratio and bottom-center ground anchor. Player shows *back* sprite, enemy *front* sprite. On missing back art, show designated fallback art and flag content completeness; do not silently mirror enemy sprite.
- Action timeline: text callout (~0.4s) → attacker anticipation (0.1–0.2s) → class-specific movement (0.2–0.4s) → type VFX (0.3–0.8s) → defender reaction + damage number (~0.2s) → HP interpolation (0.3–0.5s) → effectiveness/status text (~0.5s). Typical unskipped turn 3–6 seconds, adjustable ×1/×2.
- Generic presets: physical lunge/slash, elemental projectile/beam, ground strike, self-buff halo, debuff particles, status aura, heal sparkle. Data-driven move VFX IDs (not one JS class per move). At least 10 distinct type treatments in v1; others inherit class/type presets.
- Three arenas: Verdant Meadow (default day), Crimson Canyon (warm sunset), Astral Chamber (dark magical). Distinct atmosphere, battle floor material, shadow/contact decal, light rig, sky/gradient and color grade. Selection in setup, default = Meadow. All functional on Low VFX.
- Sprite aesthetic: Gen-V-era front/back animated sprites where available, with browser-renderable frame atlases generated **before runtime**. Preserve species-proportional framing. Static fallback and real opacity/trim data must be supported. Front-facing opponent and back-facing player always remain visually coherent.
- Audio: distinct hover/select/confirm/back, throw/start, hit physical, fire/electric/water/status/KO/XP/money, short original musical loops. User gesture enables Web Audio; mute and volume persist.
- Settings: reduced motion, low VFX, UI scale, mute/volume, animation speed, reset save with confirm. No game logic tied to frame rate or audio completion.

## J. Resilience and accessibility
- WebGL context loss shows recoverable overlay; resize adjusts renderer/camera without resetting battle.
- Sprite loading failures show a clearly styled placeholder and log warnings without crashing.
- Keyboard selection for all DOM controls, visible focus, readable contrast, optional reduced motion, semantic health text alternative, hover never required for details.
- Graceful fallback when browser audio is blocked. Pausing tab suspends decorative animation but not ongoing game-state integrity.

## K. Product success criteria
- First launch through first victory under 3 minutes.
- From setup, battle starts in <2 seconds with preloaded selected sprites on desktop broadband/local server.
- Three consecutive wins reliably persist XP and coins and result in affordable new purchase.
- Type immunity, status lockouts, priority and faint resolution are correct for deterministic seeds.
- Game remains responsive on 1920×1080 desktop at ≥55fps typical with default VFX; 30fps acceptable as explicit low-end fallback.
- Art feels coherent across all scenes, no generic alert() popups, no missing sprites or broken UI, no uncaught runtime errors.
