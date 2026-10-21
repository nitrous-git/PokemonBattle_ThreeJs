# Asset credits and distribution status

## Pokémon character images — restricted/private educational profile

- Source repository: https://github.com/PokeAPI/sprites
- Pinned revision: `97a7832d307311c0e1c6ea9035308bf80cc94f81`.
- Source paths: `sprites/pokemon/versions/generation-v/black-white/animated/{dexId}.gif` and `animated/back/{dexId}.gif`.
- Owners: Pokémon character artwork remains copyrighted by its respective owners, including The Pokémon Company, Nintendo, Creatures and GAME FREAK.
- Repository notice: https://github.com/PokeAPI/sprites/blob/97a7832d307311c0e1c6ea9035308bf80cc94f81/LICENCE.txt . The repository's CC0 statement does not override its explicit underlying image copyright notice.
- Intended use in this handoff: private educational fan-game build requested by the user. **Not publicly cleared.**
- Transform: decoded GIF compositing/disposal using Sharp/libvips; one consistent alpha trim across all frames; 2px transparent cell padding; up to 8 columns; original per-frame delays; nearest-neighbor runtime sampling. Static menu art is the first composited frame.
- Full per-orientation URLs, SHA-256 hashes, exact trim, dimensions, frame rectangles, timings and status are in `src/data/generated/spriteManifest.json`.
- All 16 species have verified front/back Gen-V GIF sources; no Showdown or Java-prototype assets were required.

Species: Pikachu, Bulbasaur, Charmander, Squirtle, Eevee, Sandshrew, Growlithe, Magnemite, Gastly, Abra, Geodude, Psyduck, Machop, Dratini, Charizard, Blastoise.

## Original project material

| Asset | Creation | Status |
|---|---|---|
| Three arena environments | Authored Three.js geometry/materials, deterministic placement | Original project source |
| Attack effects and camera responses | Authored geometric particles, rings, bolts, movement and color presets | Original project source |
| Sound cues and ambient music | Web Audio oscillators, envelopes and original note sequence | Original; no audio recordings |
| Interface and title lockup | Authored HTML/CSS, “Battle Atelier / Nitrous” text | Original; no franchise logo |
| Favicon | Authored geometric SVG | Original |
| Missing-art stand-ins | Authored geometric front/back designs | Original, not Pokémon likenesses |
| Typography | Local Arial/Helvetica/Georgia/system fonts | No font files redistributed |

The standalone `package:public` workflow replaces every character PNG with an original geometric stand-in, updates the manifest, and excludes private QA screenshots and the private prebuilt bundle. It does not claim rights clearance for retained names or trademarks.

## Data and references

PokéAPI v2 / official api-data: https://github.com/PokeAPI/api-data (pinned revision in source lock). Source-backed facts are kept separate from authored prices, move pools, effects and battle rules. API provenance is in `importManifest.json`.

Primary visual/interaction reference: https://github.com/kkatsi/pokemon-battle . Used as composition and flow reference; no React source or reference-project assets copied. The supplied Java archive was inspected for its trainer/shop/selection concepts; its source and images were not ported or shipped.
