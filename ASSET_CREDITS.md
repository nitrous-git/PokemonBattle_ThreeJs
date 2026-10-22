# Asset credits and rights status

## Pokémon sprites — third-party / not cleared for redistribution

- Source: https://github.com/PokeAPI/sprites
- Pinned sprite revision: `97a7832d307311c0e1c6ea9035308bf80cc94f81` (also in `src/data/game/source-lock.json`).
- Original sprite paths: `sprites/pokemon/versions/generation-v/black-white/animated/{dexId}.gif` and `animated/back/{dexId}.gif`.
- Character art belongs to its respective rights holders, including The Pokémon Company, Nintendo, Creatures and GAME FREAK. PokeAPI/sprites' repository license **does not clear underlying character/image rights**. See `docs/POKEAPI_SPRITES_LICENCE.txt` and https://github.com/PokeAPI/sprites/blob/97a7832d307311c0e1c6ea9035308bf80cc94f81/LICENCE.txt.
- Current use is as an unofficial fan/educational experiment. Source availability, transformation, noncommercial intent and GitHub Pages publication do **not** themselves grant permission for public redistribution.
- Processing: Sharp decodes source animation into trimmed and padded PNG atlases, with frame timings recorded. Static menu assets use prepared frames. Exact URLs, hashes, frame geometry and rights fields are in `src/data/generated/spriteManifest.json`.
- The curated roster consists of Pikachu, Bulbasaur, Charmander, Squirtle, Eevee, Sandshrew, Growlithe, Magnemite, Gastly, Abra, Geodude, Psyduck, Machop, Dratini, Charizard, Blastoise, Mewtwo, Rayquaza, Lugia, Darkrai, Lucario, Garchomp, Gengar and Tyranitar.

## Original project assets

- Procedural arenas, environment meshes/materials, VFX and camera behaviors: authored for this project (`src/render/ArenaScene.js`).
- Audio: original synthesized Web Audio cues/music (`src/services/AudioService.js`); no ripped audio recordings.
- UI and title treatment: authored HTML/CSS; `src/ui/templates.html`, `src/ui/screens.js`, `src/styles/`.
- Favicon and generic geometric missing-art stand-ins: project-authored.
- Typography: installed system fonts; no external font files bundled.

## Data and influences

- PokéAPI / official API-data: https://github.com/PokeAPI/api-data ; pinned revision `447bd5c378bf87da964bfe4dd7487a7bf1d97cbd`. Source-backed facts and source provenance are separate from curated local gameplay definitions; see `docs/CONTENT_WORKFLOW.md`.
- Main design inspiration: https://github.com/kkatsi/pokemon-battle ; visual/interaction reference only, not reused code/assets.

The earlier `package:public` source-packaging script was removed during static/CDN cleanup. Placeholder sprite generation remains available through the authoring utility `npm run assets:standins`, but no separate public-rights-cleared distribution package is currently produced. A genuine public distribution requires independent rights review and/or suitable replacement art and branding.
