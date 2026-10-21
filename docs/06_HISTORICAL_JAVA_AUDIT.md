# 06 — Historical Java Prototype Audit (user-provided src.rar)
Inspected the 70KB RAR5 archive with archive reader (99 entries). It is an old Java2D/Swing game, not browser-ready and not a code source to migrate verbatim.

## Factual inventory
- `MainApp/Main.java`: constructs `Controller.EventHandler`.
- `Controller/EventHandler.java`: attaches UI action listeners, starts combat, handles purchases, transitions back to selection; includes a level-up on combat result.
- `Model/Pokemon.java`: mutable species-like object extends `java.awt.Rectangle`; stores name, type, HP, level, attack array and draw method. Gameplay data and render position are coupled.
- `Model/Attack.java`: name, type, power, available/max usage counts; analog of PP, but no rich effects/stat category.
- `Model/Trainer.java`: trainer name, coins, owned list; one initially owned Pikachu.
- `Model/playable/*.java` and `Model/non_playable/*.java`: one Java subclass per species, including hardcoded attacks and image paths.
- `View/SelectionFrame.java`: player and opponent selectors, tabs, a Store panel, descriptions, trainer balance and buy action. Opponent roster includes Onix, Haunter (source file is `Hunter.java`), Mewtwo, Charizard, Articuno; store includes Sandshrew, Mew, Magneton, Blastoise and Charizard.
- `View/CombatSequence.java`: long scene/view file for turn flow and Java2D rendering.
- `Model/attackAnim/*`: multiple attack frame classes (Beam, Bite, Ember, Field, FireCircle, Shock, WaterGun), backed by PNG image sequences under `src/img/AtkAnim`. Asset sizes small.

## What to retain conceptually
Owned roster and shop, AI opponent catalogue, turn-based attack usability/PP, level growth, reward loop, class-based attack animation vocabulary, simple start-to-finish flow.

## What to replace
- `Pokemon extends Rectangle` → species JSON and independent combat state/visual actor.
- Java species subclass per character → generic validated `PokemonSpecies` catalogue.
- `EventHandler` monolith and Swing listeners → `GameApp` screen routes + domain commands.
- `CombatSequence` with rendering/game rules together → `BattleEngine` events + Three.js/DOM presentation queue.
- Hardcoded disk image paths → audited asset manifest and async preload.
- Ad hoc level changes and affordability check → explicit XP table/reward transaction and per-item price/coin checks.

**Licensing note:** images embedded in the old archive depict existing Pokémon. User-created source archive does not automatically grant redistribution rights for underlying franchise art or effects.

## v2 relation to PokeAPI
The old Java subclasses, sprite folders and hard-coded attack powers are historical design inspiration only. Authoritative v1 species base stats and imported move metadata come from PokeAPI; Java artwork is not accepted as redistributable by default. The redesigned engine stores per-owned-instance XP and four move IDs, while PokeAPI source facts and image provenance remain outside the save game.
