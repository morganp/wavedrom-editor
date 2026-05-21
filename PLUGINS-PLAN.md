# Plan — VS Code & Confluence integrations

The current editor is a self-contained React SPA (see `Wavedrom Editor.html`).
To embed it in VS Code and Confluence, we need to (1) make it host-agnostic and
embeddable, then (2) wrap it in a thin platform-specific shell for each host.

This document is a roadmap, not a spec — exact details (e.g. Forge vs Connect,
storage shape) need confirmation with target users.

---

## 0 · Shared prerequisites

Before either plugin ships, the SPA needs three changes.

### 0.1 Build pipeline
Today the app loads React + Babel from unpkg and transpiles JSX in the browser.
That's fine for prototyping but unacceptable inside VS Code webviews or
Confluence iframes (CSP, perf, offline).

- Introduce **Vite** (or Rollup) with `@vitejs/plugin-react`.
- One entry point per artifact:
  - `dist/standalone.html` — current behavior (no host).
  - `dist/embed.js`  + `dist/embed.css` — pure JS module exposing
    `window.WavedromEditor.mount(rootEl, opts)` (see §0.3).
- Source layout stays: `editor.jsx`, `editor-views.jsx`, `wave-render.js`,
  `samples.js`, `styles.css` — only the entry and build glue change.

### 0.2 Host-mode flag
The app has implicit dependencies on the page (localStorage for drawer height,
clipboard, file download). In **embed mode** the host owns these. Add an
`embedded` flag plumbed through `App`:

| Feature                    | Standalone        | Embedded                                  |
|----------------------------|-------------------|-------------------------------------------|
| Initial JSON               | `samples[3]`      | passed by host                            |
| Drawer height persistence  | `localStorage`    | scoped via host key, or just session-only |
| Save / Open / Copy / PNG / SVG | direct DOM     | bridge through `onCommand({type, payload})` |
| Document title             | static            | host-supplied                             |
| Tweaks panel               | enabled           | gated by host                             |
| History (undo/redo)        | in-memory         | unchanged                                 |

### 0.3 Embed SDK / host adapter
A small, stable surface for both hosts:

```ts
WavedromEditor.mount(rootEl: HTMLElement, opts: {
  initial: string | object,           // wavedrom JSON
  readonly?: boolean,
  onChange?: (json: object, jsonText: string) => void,
  onReady?: () => void,
  onCommand?: (cmd: {type: 'save'|'export'|'copy', payload?: any}) => void,
}): {
  destroy(): void,
  setJson(j: string | object): void,  // host-driven external updates
  exportSvg(): Promise<string>,
  exportPng(): Promise<Blob>,
}
```

All inter-host messaging boils down to this contract. The VS Code and
Confluence shells are just translators between platform messages and these
calls.

---

## 1 · VS Code extension

Goal: opening a `.wavedrom.json` (or `.wd.json`) file in VS Code shows the
visual editor as a custom editor; the text editor is still available via
*Reopen With…*. Saves go through the normal editor model so source control
sees a regular JSON diff.

### 1.1 Activation & registration
- `package.json` → `contributes.customEditors`:
  ```json
  {
    "viewType": "wavedrom.editor",
    "displayName": "WaveDrom",
    "selector": [{ "filenamePattern": "*.wavedrom.json" }],
    "priority": "default"
  }
  ```
- Also register `wavedrom.openAsDiagram` command so users can right-click any
  JSON file with a wavedrom-shaped payload and open it visually.

### 1.2 Custom editor provider
Implement `vscode.CustomTextEditorProvider`. The webview hosts the embed
bundle; the provider:

| VS Code event                       | Action                                             |
|-------------------------------------|----------------------------------------------------|
| `resolveCustomTextEditor`           | Create webview, inject `embed.js/.css`, postMessage `init` with `document.getText()` |
| webview `onDidReceiveMessage` `change` | Apply `WorkspaceEdit` replacing the whole document with new JSON (debounced) |
| `document.onDidChange` (external)   | postMessage `setJson` to webview (skip if our own edit) |
| webview `command:export`            | Spawn `vscode.window.showSaveDialog` then `fs.writeFile` |

### 1.3 Webview hardening
- CSP: `default-src 'none'; style-src ${cspSource}; script-src ${cspSource} 'nonce-...';`
- Bundle ships in extension package — no CDN, no Babel.
- `retainContextWhenHidden: true` so undo history isn't lost on tab switch.

### 1.4 Theming
The embed already uses CSS variables. Wire a small `<style>` block into the
webview that maps VS Code's `--vscode-editor-foreground` etc. to our
`--ink`, `--bg`, `--accent` tokens so the editor follows the user's theme
(light/dark/HC).

### 1.5 Optional niceties
- **Hover preview** in `.md` / `.tex` / `.rst` files: a `HoverProvider` that
  detects fenced ```wavedrom``` blocks and renders an inline SVG via
  `exportSvg()` from a hidden headless instance.
- **Status bar** "Open as diagram" button when the active file looks like a
  wavedrom spec.
- **Snippet contribution** for new files.

### 1.6 Distribution
- `vsce package` → `.vsix`
- Publish to the VS Code Marketplace and OpenVSX (Cursor, VSCodium).

### 1.7 Risks
- VS Code webviews can't access the file system directly — exports must
  round-trip through the extension host.
- Large JSON diffs through `WorkspaceEdit` can be slow; debounce to ~250ms.

---

## 2 · Confluence plugin

The draw.io comparison is apt: an inserted **macro** stores its source JSON in
the macro body; double-clicking opens a modal containing the editor; save
writes the JSON back to the macro body and re-renders the inline SVG preview.

### 2.1 Platform choice
| Option   | Status        | Recommendation                              |
|----------|---------------|---------------------------------------------|
| **Forge** (Custom UI) | Atlassian's modern platform; cloud-only; iframe-sandboxed | **Primary target** — required for new Cloud apps |
| Connect  | Legacy cloud; external hosting | Only if Forge limits hurt (e.g. iframe size, no full-page modal) |
| P2 / Data Center | On-prem, Java | Separate effort; share the same embed bundle |

Plan assumes **Forge Custom UI**.

### 2.2 Module layout (`manifest.yml`)
```yaml
modules:
  macro:
    - key: wavedrom-macro
      resource: macro-view
      render: native        # so inline preview is fast
      title: WaveDrom diagram
      description: Embed a timing diagram
      config:
        function: wavedrom-config
      properties:
        layout: full-width
  function:
    - key: wavedrom-config
      handler: index.config
  resources:
    - key: macro-view
      path: build/macro/
    - key: editor-modal
      path: build/editor/
```

### 2.3 View → edit flow
1. **Macro view** (read-only, inline on the page):
   - Reads macro `body` (the wavedrom JSON).
   - Calls our `exportSvg()` headlessly and renders an `<svg>` directly.
   - Shows an *Edit* button that opens the modal.
2. **Edit modal** (full editor):
   - Hosted by the `editor-modal` resource.
   - Mounts the embed via `WavedromEditor.mount(root, { initial, onChange, onCommand })`.
   - On save: calls `view.submit({ body: jsonText })`; Forge persists it in
     the page version.
   - On cancel: `view.close()`.
3. **Macro re-renders** with the new JSON and refreshed SVG.

### 2.4 Storage
- Forge macros: the JSON sits in the macro's `body` property — versioned with
  the page, surfaces in page history diffs, copy-pastes between pages.
- For very large diagrams (>32KB), fall back to Forge `storage.entity` keyed
  by a UUID stored in the macro body.

### 2.5 Authoring affordances
- Macro insertion shows a small starter (the same `samples[0]` we ship).
- An **"Insert from JSON"** menu item in the editor toolbar for paste-flow.
- Read-only renderer used on:
  - Published page views
  - Page exports (PDF / Word) — Forge hands the SVG to the renderer.

### 2.6 Risks
- Forge UI Kit doesn't support custom canvases — we **must** use Custom UI
  (iframe), so we inherit its CSP and `bridge.invoke` round-trip costs.
- iframe height: the editor is fluid; we'd need to message the parent with
  `useProductContext().platformContext.contentId` and call `view.resize()`
  on layout changes.
- Forge invocation quotas — we don't hit backend functions on every keystroke;
  state stays client-side until save.

### 2.7 Confluence Data Center / Server
The Forge app covers Cloud. Data Center needs a parallel **P2 (Atlassian
Plugin SDK)** package — Java + Spring + Velocity, packaged as `.obr`.

- Same embed bundle (`embed.js`/`embed.css`) is served from
  `<atlassian-plugin>/web-resources`.
- Macro definition in `atlassian-plugin.xml` instead of `manifest.yml`.
- Macro body stored as macro parameter / rich-text storage; rendered to SVG by
  a small server-side renderer (`headless-chrome` or a static Java port of
  `wave-render.js`) so PDF / Word export still works.
- Editor modal opens via Atlassian's `AJS.Confluence.MacroBrowser.Macros`
  or the newer `AP.dialog.create()` API (depending on Confluence version).

Shipping both Cloud and Data Center doubles the integration surface but the
**editor source is shared**; the work is in the host shells. Plan to release
Cloud first, Data Center one milestone later.

---

## 3 · Shared work, in order

**Phase 1 — Canonical file format (`.wavedrom.json`)**
1. **Refactor build** (§0.1) — biggest unlock; everything else depends on it.
2. **Embed mode + SDK** (§0.2, §0.3) — write a `demo-host.html` that mounts
   the embed in an iframe and proves the message contract works.
3. **VS Code extension** with `.wavedrom.json` custom editor.
4. **Confluence Forge app** (Cloud) — macro stores JSON in its body.
5. **Confluence Data Center plugin** (§2.7) — reuses the same embed bundle.

**Phase 2 — Markdown layer & polish**
6. **VS Code markdown CodeLens** — *"Edit visually"* above ```wavedrom```
   fenced blocks; opens the editor scoped to that range.
7. **Hover / inline preview** for both hosts — a fast headless `exportSvg()`
   pipeline rendering thumbnails in markdown previews and Confluence
   page-render snapshots.

---

## 4 · Decisions

- **Confluence target**: support **all versions** — Cloud (Forge) **and** Data
  Center / Server. The web bundle is the same; only the host shell differs.
  See §2.7 for the Data Center addition.
- **Theme**: **follow the user's theme** in both hosts. VS Code maps its
  `--vscode-editor-*` vars to ours; Confluence reads
  `themeState` from `view.getContext()` and toggles a `[data-theme="dark"]`
  attribute on the editor root.
- **Collaboration model**: **last-writer-wins**. No real-time multi-user
  presence. Confluence's page versioning is the conflict-resolution story.
- **License**: **MIT** (see §5).
- **File format**: **Option C** — `.wavedrom.json` is canonical
  (Phase 1); a markdown fenced-block CodeLens is a follow-on layer
  (Phase 2). See §6.

---

## 5 · License recommendation: MIT

Upstream **WaveDrom is MIT-licensed** (Aliaksei Chapyzhenka, since 2011), and
this project depends conceptually on its file format and spec. Both MIT and
BSD-3-Clause are permissive licenses and both are compatible with WaveDrom
itself — meaning either choice would allow us to fork or vendor WaveDrom
internals later without friction.

| Aspect                              | MIT                              | BSD-3-Clause                          |
|-------------------------------------|----------------------------------|---------------------------------------|
| Compatibility with WaveDrom (MIT)   | ✅ identical, no friction         | ✅ permissive, also fine               |
| Length / clarity                    | ~20 lines, very simple           | ~25 lines, adds the no-endorsement clause |
| Ecosystem norm (JS / VS Code / Atlassian apps) | dominant                | uncommon in this stack                |
| Extra constraint                    | none beyond attribution          | "do not use our name to endorse derivatives" |
| Patent grant                        | none (implied)                   | none                                  |
| Marketplace acceptance              | ubiquitous                       | accepted                              |

**Recommendation: MIT.** The no-endorsement clause in BSD-3 doesn't add
practical protection for a tool like this, and MIT matches what every
downstream consumer (VS Code Marketplace, Atlassian Marketplace, npm) expects.
If we ever need patent protection later, the upgrade path is **Apache 2.0**,
not BSD-3.

Action: drop `LICENSE` at the project root with the standard MIT text and
attribute the copyright to the project author(s).

---

## 6 · File extension: `.wavedrom.json` vs Markdown fenced blocks

This is two different distribution models, not a naming preference. Each
implies a different editor activation point and a different storage story.

### Option A — Dedicated extension (`*.wavedrom.json` or `*.wd.json`)
The diagram lives in its own file containing just the WaveDrom spec.
```
docs/
  spi-burst-read.wavedrom.json     ← editor opens here
  spi-burst-read.svg               ← optional, generated on export
```
- **VS Code**: `CustomTextEditorProvider` activates exclusively on the pattern.
  Cleanest UX — open the file, get the visual editor; *Reopen With… → Text*
  is always available for raw JSON.
- **Confluence**: stored as an attachment or as macro body; macro references
  it by file ID.
- **Pros**
  - Source-control diff is pure JSON, easy to review.
  - Clear ownership — one diagram, one file.
  - Easy headless rendering (CI exports `.svg` next to the source).
  - No parser ambiguity, no partial-document editing.
- **Cons**
  - Adds a file per diagram — friction for "I just want a diagram in this
    README" use cases.
  - GitHub previewers don't recognise a custom extension; needs an action /
    bot to render.

### Option B — Fenced blocks inside Markdown
The diagram is embedded in prose, like Mermaid:
````md
## SPI burst read

```wavedrom
{ "signal": [ {"name": "clk", "wave": "p..." }, ... ] }
```
````
- **VS Code**: a `CodeLensProvider` decorates each ```wavedrom``` block with
  *"Edit visually"*. Clicking opens the editor in a side-by-side webview;
  saving rewrites just that block's text range in the markdown buffer.
- **Confluence**: stays a macro — same as today, just rendered from a
  fenced-block convention if pasted from markdown.
- **Pros**
  - Diagrams travel with the prose that describes them.
  - GitHub-flavoured-markdown ecosystem (Mermaid, PlantUML, WaveDrom) is
    where users already expect to find these.
  - Zero extra files in the repo.
- **Cons**
  - Editor mounts on a substring of a larger file → more plumbing (track
    block positions, debounce partial edits, handle stale ranges on external
    edits).
  - Harder to lint / schema-validate; JSON errors get hidden inside markdown.
  - Cross-block references (shared node letters between diagrams) get
    awkward.

### Option C — Both (recommended)
This is the **draw.io model**: a primary file format (`.drawio` / `.png`
with embedded XML) plus integration with hosts that don't ship files
(Confluence macros). Concretely:

1. **Ship Option A first.** `.wavedrom.json` is the canonical, lintable,
   source-controlled form. VS Code custom editor and Confluence macro both
   read/write it.
2. **Add Option B as a layer.** Once the embed SDK is stable, add a markdown
   CodeLens in the VS Code extension that opens the editor scoped to a
   fenced block. The editor itself doesn't care — it just receives JSON
   text via `mount({initial})` and emits JSON text via `onChange`. The host
   shell does the block-extraction and range-replacement.

This lets you give users both workflows without forking the editor or
storing two file formats.

### Decision
**Option C** — ship A first, layer B on top once the embed SDK is stable.
Phase 1 delivers the canonical `.wavedrom.json` file format with VS Code
custom editor and Confluence macro. Phase 2 adds the markdown
fenced-block CodeLens in VS Code. The editor itself stays
host-agnostic — the markdown shell does block-extraction and
range-replacement around the same `mount({initial})` / `onChange(json)`
contract.
