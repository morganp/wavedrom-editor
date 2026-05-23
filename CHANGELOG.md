# Changelog

All notable changes to this project are documented here.
Versions follow [Semantic Versioning](https://semver.org).

## [0.4.22] — 2026-05-23

### Confluence Forge (Cloud) plugin
- Add `packages/confluence-forge/package.json` with `@forge/api` + `@forge/bridge` deps.
- Fix `manifest.yml`: drop `render: native` (UI Kit syntax incompatible with Custom UI macro); declare `wavedrom-load` + `wavedrom-save` functions; trim scopes to `storage:app` only.
- Rewrite `src/index.js`: `defaultConfig` mints a UUID and seeds `storage.set('diagram:<uuid>')` with the default WaveJSON; add `loadDiagram` + `saveDiagram` handlers.
- Fix `resources/macro/index.html`: use `new Modal({ resource: 'editor-modal', context })` instead of invalid `invoke('openEditorModal')`; reload + re-render `onClose`.
- Fix `resources/editor/index.html`: read `{ uuid, initial }` from `extension.modal.context`; add explicit Save/Cancel buttons that call `invoke('wavedrom-save')` then `view.close()` (modals use `close`, not the `view.submit` config flow).
- Add `resources/icons/wavedrom.svg` placeholder icon (referenced by manifest).
- Document storage trade-off vs draw.io (page-copy leaks edits — accepted), Forge CLI prereqs, deploy + tunnel commands in `confluence-forge/README.md`.

## [0.4.21] — 2026-05-23

### Web distribution
- Add `npm run build:web-zip` (`scripts/build-web-zip.sh`) — builds `dist/standalone/` and packages it as `Wavedrom-Editor-v<version>.zip` with a versioned top-level folder.
- Document the built bundle as the sole supported web distribution path in `README.md` and `CLAUDE.md`.
- Note legacy `Wavedrom Editor.html` as broken since v0.4.0 ES-module refactor (classic `<script>` tags cannot load `export`/`import` sources).

### Repo
- `.gitignore`: ignore `Wavedrom-Editor-v*.zip` build artifacts.

## [0.4.1] — 2026-05-21

### VS Code extension
- Fix blank fenced-block editor: removed `await openTextDocument` that delayed `onDidReceiveMessage` registration, causing `hello` to arrive before the handler was ready.
- Guard `JSON.parse` of `initial` prop in `App` — invalid/empty JSON now falls back to default sample instead of crashing render.

## [0.4.0] — 2026-05-21
Phase 1 implementation begins: shared embed SDK + plugin scaffolding.

### Editor
- `App` now accepts props (`initial`, `onChange`, `onCommand`, `embedded`,
  `readonly`, `bridge`) so it can be mounted by external hosts.
- Tweaks panel auto-hides in embed mode (host owns the chrome).
- `saveJson` routes through `onCommand` when a host is present.

### New files
- **`embed-boot.js`** — `WavedromEditor.mount(rootEl, opts)` SDK + a
  `postMessageHost(rootEl)` adapter that speaks the `init` / `setJson` /
  `change` / `ready` protocol.
- **`embed.html`** — embeddable entry that loads the editor and starts the
  postMessage host.
- **`demo-host.html`** — host-side proof-of-concept (iframe + JSON textarea
  + message log) demonstrating the SDK round-trip.

### Plugin scaffolds
- **`packages/vscode-extension/`** — `package.json`, `tsconfig.json`,
  `src/extension.ts` (CustomTextEditorProvider for `*.wavedrom.json` plus
  a markdown fenced-block CodeLens), and a README.
- **`packages/confluence-forge/`** — `manifest.yml`, default-config
  function, macro view + editor modal Custom UI resources, README.
- **`packages/confluence-dc/`** — `atlassian-plugin.xml`, `pom.xml`,
  README. Reuses the same embed bundle.

### Project
- `LICENSE` (MIT).
- `.gitignore` (build outputs, node_modules, IDE, OS, env).
- Top-level `README.md` documenting the layout and SDK contract.
- `DEPLOY.md` — deployment guide for all four artifacts (standalone web app,
  VS Code Marketplace + OpenVSX, Confluence Cloud via Forge, Confluence DC
  via Atlassian SDK).

## [0.3.0] — 2026-05-21
Third release. Cumulative notes for the work to date.

### Editor
- Waveform canvas with drag handles for transitions, phase, and period.
- Click cycle to toggle through `0 → 1 → l → h → p → n → x → z`.
- Right-click context menu on any cycle:
  - Set logic / clock / special / **bus** values (`=`, `2`–`5`)
  - Tag the cell as an edge **node** (single letter)
  - Set the **bus value label** for `data[]` slot
  - **Start / Finish edge** flow with op picker
- Inspector for the selected signal (name, wave, phase, period, data, node).

### Doc panel
- Collapsible **Header / Footer / Config / Edges** sections (state persists).
- Edges editor — list rows with `from / op / to / label`, per-row `−` delete, `+ edge` add.
- Node autocomplete via `<datalist>`; tooltip lists every available node and its signal/cycle.

### Edges
- Draggable endpoints on the canvas — reconnect by dragging a handle to a new cell.
- Drop-target overlay snaps to the cell's **left edge** (node anchor point).
- Improved arrowheads: shared `auto-start-reverse` marker supports `<-`, `->`, `<->`.
- Old node letters scrubbed automatically when no longer referenced.

### JSON drawer
- Live two-way sync with the canvas.
- **Draggable top edge** to resize; double-click to collapse. Height persists in localStorage.
