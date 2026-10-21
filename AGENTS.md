# Astra / development agent — Battle Atelier

This is the entry point for future feature work. **Read this file first.** Read only the supporting document and source files relevant to the current task; do not reload the entire documentation or the full repository on each turn.

## Ground truth and setup

- Repository: `nitrous-git/PokemonBattle_ThreeJs`; default branch: `master`.
- Browser-native ES modules, vanilla JavaScript, Three.js **0.180.0 via the pinned CDN import map**, CSS, and static GitHub Pages. **No Vite, bundler, React, TypeScript, or npm runtime.**
- App boot: `index.html` -> `src/main.js` -> `loadTemplates()` -> `new GameApp()`.
- Browser needs HTTP(S), not `file://`. Development: WebStorm static server or `npm run serve`; `npm install` is needed only for optional authoring/tests.
- The code and committed data are authoritative. If a document conflicts with source, inspect the implementation and correct the document only when the change is relevant.

## Minimal selective reading

1. Always: `AGENTS.md` and the user’s exact feature request.
2. For gameplay, UI, renderer, saves, routing: `docs/ARCHITECTURE.md` **plus only affected source files**.
3. For roster, moves, economy, PokéAPI, images: `docs/CONTENT_WORKFLOW.md` **plus affected files**.
4. For what is already shipped, scope and proposals: `docs/CURRENT_STATE.md`.
5. For asset rights: `ASSET_CREDITS.md` and `docs/POKEAPI_SPRITES_LICENCE.txt` when relevant.

Avoid scanning `src/data/source/snapshot.json` (~11.8 MB), entire generated catalogues, the CSS file, or the full sprite manifest unless necessary. Start with focused symbol searches and bounded file reads; use exact paths. Do not treat the old v2 design pack as current implementation documentation.

## Implementation rules

- **Actively develop**: create/edit the required source, templates, assets, and tests. This is not a read-only audit. Do not push, merge, or rewrite Git history unless explicitly requested; the user normally reviews and pushes locally.
- Keep one feature/task focused. Prefer small existing modules to new layers of managers, event buses, state frameworks, build tools, or abstraction for its own sake.
- Preserve existing features, CSS selectors and responsive design. Keep `#arena`/Three.js canvas outside the replaceable `#app` DOM subtree.
- Gameplay math, AI and progression belong to `src/domain/`; `GameApp` orchestrates input and turn presentation; `src/ui/templates.html` owns structural markup; `src/ui/screens.js` binds current state; `src/ui/components.js` owns reusable dynamic pieces.
- Use `textContent` for untrusted strings; `innerHTML` only for controlled, escaped component markup. Maintain `data-action`, `data-route`, `data-id`, `data-slot`, `data-bind`, and `data-slot` contracts as applicable. Screen updates should not break delegated event handling.
- `resolveTurn` stays deterministic, given battle snapshot and commands. It must not touch DOM, Three.js, storage or fetch data. Never reveal the player's submitted move to AI selection.
- Preserve save compatibility (`saveVersion: 1`, revision checking, unique `battleId` reward deduplication) or provide a deliberately tested migration. No silent save reset or removal of owned Pokémon/moves.
- Pokémon data and sprites are **authored/generated locally**, not fetched from PokéAPI during gameplay. Preserve provenance, source locks, and rights metadata. Three.js CDN is the known browser-external dependency.
- Never assume game artwork is cleared for public redistribution. Consult `ASSET_CREDITS.md` before adding or distributing assets.

## Deliver and verify

- First inspect affected contracts; implement the smallest complete change with targeted tests. Don't regenerate old documentation or full import snapshots for unrelated work.
- For code changes, run available relevant checks: `npm run test`, `npm run lint`, `npm run data:validate`, `npm run assets:check` as appropriate. Browser-facing changes also need manual or Playwright checks (`npm run test:browser` when available), including GitHub Pages subpath behavior.
- Report exactly what changed, which checks passed/failed/not run, any risks, and how to try the feature. Do not claim tests ran when they did not.
- Update `docs/CURRENT_STATE.md` **only** when shipped scope changes; update other docs only when their contracts change. Keep the docs short.
