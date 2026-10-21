# Battle Atelier — Pokémon Battle (Three.js)

A browser-based, unofficial single-player Pokémon battle simulator: pick a starter, challenge opponents in procedural 3D arenas, earn experience/coins, and recruit Pokémon into a persistent collection.

## Run

Open this repository with **WebStorm's HTTP/static server**, or use `npm run serve` / `node scripts/static-server.mjs` (Node.js 22.12+ for developer tooling), then visit the local URL. The site is also deployable directly to GitHub Pages from repository files: **no Vite, build, or npm install is required for hosting**. Do not run the ES modules with `file://`.

`index.html` pins Three.js from jsDelivr; the game loads local JSON, images, and one same-origin UI template file. An internet connection may be needed for the Three.js CDN unless cached.

Optional developer commands (after `npm install`):

```sh
npm run test
npm run lint
npm run data:validate
npm run assets:check
npm run test:browser
```

The browser test uses Playwright Chromium; install its browser runtime when required. Data/sprite import tools are authoring-only and are not used by GitHub Pages.

## Documentation

- **`AGENTS.md`** — fast instructions for Astra / coding agents; start here for feature implementation.
- **`docs/CURRENT_STATE.md`** — shipped features, present limits, and uncommitted feature ideas.
- **`docs/ARCHITECTURE.md`** — source map, APIs, UI bindings, battle/save constraints.
- **`docs/CONTENT_WORKFLOW.md`** — curated data, sprite pipeline, update/check commands.
- **`ASSET_CREDITS.md`** and **`docs/POKEAPI_SPRITES_LICENCE.txt`** — asset provenance and rights cautions.

This is an unofficial fan/educational experiment, not affiliated with Pokémon's rights holders. The sprite artwork is **not cleared for redistribution** simply because it can be downloaded from a source repository; see asset credits.
