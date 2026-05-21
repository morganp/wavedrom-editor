# Wavedrom Editor

A visual editor for [WaveDrom](https://wavedrom.com) timing-diagram JSON.

## Repo layout

```
.
├─ Wavedrom Editor.html      # standalone editor (open in any browser)
├─ embed.html                # embeddable editor for plugin hosts
├─ embed-boot.js             # WavedromEditor.mount() SDK
├─ demo-host.html            # iframe + postMessage proof-of-concept
├─ editor.jsx                # React app entry
├─ editor-views.jsx          # Toolbar, Workarea, DocPanel, CycleMenu, ...
├─ wave-render.js            # waveform parser + SVG generator
├─ samples.js                # bundled sample diagrams
├─ styles.css                # editor theme tokens
├─ tweaks-panel.jsx          # in-design tweak controls
│
├─ packages/
│  ├─ vscode-extension/      # VS Code custom-editor + markdown CodeLens
│  ├─ confluence-forge/      # Confluence Cloud (Forge Custom UI)
│  └─ confluence-dc/         # Confluence Data Center / Server (P2 / Maven)
│
├─ PLUGINS-PLAN.md           # roadmap for plugin hosts
├─ CHANGELOG.md
├─ CLAUDE.md                 # project notes
└─ LICENSE                   # MIT
```

## Run the standalone editor

Open `Wavedrom Editor.html` in any modern browser. No build step.

## Try the embed contract

Open `demo-host.html`. It iframes `embed.html` and proves the
`postMessage` protocol: typing in the host textarea pushes JSON to the
editor; editing inside the editor mirrors the JSON back into the textarea.

```
host                      iframe / editor
 │   {type:'hello'}           ← startup announce
 │←──────────────────────
 │   {type:'init',
 │    payload:{initial}}      → first paint
 │──────────────────────→
 │   {type:'ready'}            ← mount complete
 │←──────────────────────
 │   {type:'change',
 │    payload:{json,jsonText}} ← every edit
 │←──────────────────────
 │   {type:'setJson',
 │    payload:'...'}            → host-driven update
 │──────────────────────→
```

That same contract is what the VS Code extension and Confluence plugins
will speak — they just translate platform messages into it.

## Embed SDK

```js
const api = WavedromEditor.mount(rootEl, {
  initial: '{ "signal": [...] }',
  onChange: (json, jsonText) => { /* persist */ },
  onCommand: (cmd) => { /* save/export hooks */ },
});
api.setJson(newJsonText);  // host-driven update
api.destroy();
```

## Building the plugins

Every plugin shares the same embed bundle built from the repo root.

### VS Code extension (VSIX)

```sh
# 1. Build the shared embed bundle
npm run build:embed          # → dist/embed.iife.js + dist/embed.css

# 2. Package the extension
cd packages/vscode-extension
npm run package              # → wavedrom-editor-<version>.vsix
```

Install in VS Code via **Extensions → ... → Install from VSIX**.

See [`packages/vscode-extension/README.md`](packages/vscode-extension/README.md) for details.

## License

[MIT](LICENSE).
