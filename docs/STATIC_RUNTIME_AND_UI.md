# Battle Atelier — Current Static Runtime and UI (Phase B–C)

> Current implementation guide, October 2026. Earlier `02_ARCHITECTURE.md` is the original production plan and retains historical Vite references. **This file describes the shipped CDN-based runtime.**

## Runtime

- **Static GitHub Pages:** `index.html` loads the pinned Three.js `0.180.0` import map and `src/main.js` as a native ES module. There is no Vite build step, package installation, or Node process on GitHub Pages.
- **Local development:** serve the repository over HTTP in WebStorm or via `node scripts/static-server.mjs` / `npm run serve` (Node optional for authoring). Do not use `file://` for module/JSON/template loading.
- **Asset paths:** continue using `src/assetUrl.js` so `public/assets` resolves relative to a GitHub Pages repository subpath.
- **Application entry:** `src/main.js` requests `src/ui/templates.html` once, using `new URL('./templates.html', import.meta.url)`. The request is same-origin, local to the repository, and runs before `new GameApp()`.
- **Data:** generated local JSON and sprite atlases are read by the app. PokéAPI import and sprite generation are development-time activities only.

## UI ownership

| File | Responsibility |
|---|---|
| `src/ui/templates.html` | Semantic, static screen structure: header, footer, nine screen contexts, and dialog. This is editable as native HTML in WebStorm. |
| `src/ui/screens.js` | Clones HTML templates, binds state safely with `textContent`, and creates genuinely dynamic lists/visual components. |
| `src/ui/components.js` | Existing smaller HTML-producing components such as Pokémon cards, type badges, sprites and health panels. |
| `src/app/GameApp.js` | Save state, route changes, input delegation, audio cues, battle command sequencing, VFX timing and DOM updates. It no longer contains complete screen layouts. |
| `src/styles/style.css` | Existing design system and responsive styling. Unchanged by Phase B–C. |

### Contracts that must stay stable

- `data-action` names are authoritative for click delegation.
- `data-route`, `data-id`, and `data-slot` on user-facing controls preserve their original meanings.
- `#filter`, `#owned-select`, `#tier`, `#difficulty`, `#arena-select`, `#volume`, `#uiScale`, `#speed` are handled by `GameApp`.
- `#opponent-hud`, `#player-hud`, `.battle-log`, `.move-button`, `#battle-floats` are used by live battle presentation and browser QA.
- Three.js arena/canvas lifecycle stays outside the UI mount (`#app`). Navigating screens replaces only DOM under `#app`.
- **Do not embed `innerHTML` with unescaped player/save text.** The DOM bindings use `textContent` for dynamic text. Existing trusted component HTML is used for generated battle/UI fragments and battle log text is escaped.

### Adding a new screen

1. Add a native `<template id="screen-...">` to `src/ui/templates.html` with normal HTML and `data-bind`/`data-slot` hooks only where data changes.
2. Add one small screen binder function in `src/ui/screens.js`, then route it through `createScreen(app)`.
3. Add an application route or relevant event in `GameApp.js` only if it requires new state/actions.
4. Keep battle mathematics and economy changes in `src/domain/`, never inside HTML or UI event handlers.
5. Preserve CSS class names and selectors unless intentionally changing layout.

## Development tools (`package.json`)

`npm install` is optional for playing the game or hosting GitHub Pages. The pinned development dependencies remain available for reproducible validation and future content imports.

- `npm run serve`: local static HTTP server (the underlying Node script has no package dependencies).
- `npm run test`: Vitest domain/asset/template checks; requires npm dev dependencies.
- `npm run test:browser`: Playwright visual/gameplay smoke QA; requires Playwright Chromium.
- `npm run lint`: ESLint; `npm run format`: Prettier.
- `npm run data:import`, `data:compile`, `data:validate`: offline-authored data and reproducibility tooling.
- `npm run assets:prepare`, `assets:check`, `assets:standins`: sprite atlas authoring, checks, and placeholder generation.
- Obsolete `package:public` script removed; the separate distribution packaging workflow is not required for normal Pages hosting.

## Validation checklist

After copying files into the existing repository, run:

```sh
node --check src/app/GameApp.js
node --check src/ui/screens.js
node --check src/main.js
npm install
npm run test
npm run lint
npm run test:browser
```

Then use the browser to check: initial menu, starter choice, opponent selection, changing partner, three difficulties/arenas, keyboard shortcuts `1`–`4` and Space, battle log/health/VFX, result rewards, save reload, shop purchase, collection, settings and modal dialogs, viewport at 390px, missing sprite fallback, and GitHub Pages repository-subpath deployment.

**Reproducibility note:** Because the master repository source could be read via the connected GitHub integration but could not be checked out into the local execution sandbox, validation in this delivery includes JavaScript syntax checks and static template-binding checks; full end-to-end gameplay and visual-browser QA must still be run against the complete repository. No claim of a verified end-to-end pass is made.

## Installation from the ZIP

The ZIP contains replacement files at paths relative to the repository root. Copy with folder structure preserved. Do not replace or remove `public/`, `src/data/`, `src/domain/`, `src/render/`, `src/services/`, or your CSS. Keep `src/ui/components.js` unchanged. Commit/push using your normal workflow after local QA. No Git patch or migration script is needed.
