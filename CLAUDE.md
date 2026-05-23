# Project notes

## Versioning rule — ALWAYS increment on every build
**Bump the version on every single build, no exceptions.**

Files to update:
- `packages/vscode-extension/package.json` — `"version"` field
- `packages/vscode-extension/src/extension.ts` — version string in the `getHtml` debug bar
- Root `package.json` if a root-level release is being cut

Use **semantic versioning**:
- **MAJOR** — breaking changes to JSON schema, file layout, or persisted state shape.
- **MINOR** — new user-visible features (new panels, new interactions).
- **PATCH** — bug fixes, visual polish, refactors that don't change behavior.

Keep `CHANGELOG.md` at the project root up to date — append an entry for each version bump.

## Building the VS Code VSIX

Two-step process. Run from the **repo root**:

```sh
# Step 1: build the shared embed bundle (React app → IIFE)
npm run build:embed
# produces dist/embed.iife.js and dist/embed.css

# Step 2: package the extension (copies embed bundle, compiles TS, runs vsce)
cd packages/vscode-extension
npm run package
# produces wavedrom-editor-<version>.vsix
```

`npm run package` triggers `vscode:prepublish` automatically, which:
1. `build:webview` — copies `../../dist/embed.iife.js` → `media/embed.js` and `embed.css`
2. `compile` — runs `tsc` to produce `out/extension.js`
3. `vsce package` — bundles everything into the `.vsix`

Install in VS Code via **Extensions → ... → Install from VSIX**.

## Packaging the web version

Single supported path: built bundle from `npm run build:standalone`.

```sh
npm run build:web-zip        # → Wavedrom-Editor-v<version>.zip at repo root
```

Internals (see `scripts/build-web-zip.sh`):
1. Reads version from `packages/vscode-extension/package.json` (canonical version source).
2. Runs `vite build` (writes `dist/standalone/`).
3. Zips `dist/standalone/` → `Wavedrom-Editor-v<version>.zip`.

Output tree inside the zip:

```
dist/standalone/
├─ index.html
└─ assets/
   ├─ index-<hash>.js     # React + editor bundle, ~67 kB gzip
   └─ index-<hash>.css    # ~4 kB gzip
```

Static host, no runtime deps. For subpath hosting, set `base: '/subpath/'` in `vite.config.js` before building.

### Legacy `Wavedrom Editor.html` — broken

`Wavedrom Editor.html` + sibling `.jsx`/`.js` source files **no longer work standalone** since v0.4.0 ES-module refactor. The HTML loads `wave-render.js`, `samples.js` etc. as classic scripts but they now use `export`, and `editor.jsx` uses bare `import` specifiers Babel-standalone cannot resolve. Confirmed via headless Chrome:

```
wave-render.js:288  Uncaught SyntaxError: Unexpected token 'export'
samples.js:2        Uncaught SyntaxError: Unexpected token 'export'
App is not defined
```

Either delete `Wavedrom Editor.html` or rewrite it to use `<script type="module">` + `data-type="module"` on the Babel tag. Until then, all web distribution must go via the built bundle.

### Files NOT needed for the built web version

`embed.html`, `embed-boot.js`, `embed.jsx`, `demo-host.html`, `main.jsx`, `view.js`, `Wavedrom Editor.html`, `packages/`, `dist/embed.*`, `dist/view.*` — those are for plugin hosts (VS Code, Confluence) or unused legacy entries.

## TODO

- [ ] Build and test Confluence Cloud plugin (`packages/confluence-forge`)
- [ ] Build and test Confluence Data Center / Server plugin (`packages/confluence-dc`)

## Downloads
- Use **semantic versioning** in download zip filenames (e.g. `Wavedrom-Editor-v0.3.0.zip`).
- Keep a short `CHANGELOG.md` at the project root listing what changed per version. Append a new entry when bumping.
