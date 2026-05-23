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

- [x] Build and test Confluence Cloud plugin (`packages/confluence-forge`) — v0.5.0, deployed to `lizard-spock.atlassian.net` development environment, edit + save round-trip verified
- [ ] ~~Build and test Confluence Data Center / Server plugin (`packages/confluence-dc`)~~ — **deferred indefinitely**. Cloud-only strategy for now. DC requires a separate Maven + Java + atlas-sdk toolchain, separate Marketplace listing, and a server-side render path for PDF/Word export. Revisit only if on-prem customer demand appears.

## Confluence Forge (Cloud) plugin — non-obvious gotchas

Hard-won lessons from getting `packages/confluence-forge` to work end-to-end. Bake these into any future Forge work to skip the rediscovery loop.

### Manifest / runtime

- **`render: native` is UI Kit only** — strip it from Custom UI macros (otherwise the macro silently fails to register a usable resource).
- **`nodejs20.x` is deprecated** — use `nodejs22.x` (or newer). `forge deploy` rejects 20.x at manifest validation.
- **`icon: resource:...` for the macro module** wants a single-file resource; pointing at a directory key fails with "Hosted resource for icon or thumbnail missing". Easiest: drop the icon for now, or declare the resource as the literal `.svg` path.

### Resolver wiring (this is the one that ate the most time)

- Custom UI macros invoke backend functions through a **resolver**, not via standalone `function:` keys. The macro module needs:
  ```yaml
  macro:
    - key: ...
      resource: ...
      resolver:
        function: resolver
  function:
    - key: resolver
      handler: index.handler
  ```
  Calling `invoke('foo', payload)` from the iframe without a resolver gives: `Entry point "resolver" for extension "<macro-key>" could not be invoked as it does not exist or does not reference a function or endpoint`.
- The resolver implementation needs a webpack CJS-interop guard around the default import — `@forge/resolver`'s default export sometimes shows up under `.default` after the Forge bundler runs:
  ```js
  import ResolverImport from '@forge/resolver';
  const Resolver = ResolverImport?.default || ResolverImport;
  ```
  Skipping this gives `_forge_resolver__WEBPACK_IMPORTED_MODULE_0__ is not a constructor` at runtime.
- Do **not** set `"type": "module"` in the Forge package.json — the Forge bundler+resolver combo expects CJS-style interop.

### Custom UI HTML must be bundled

- Forge Custom UI iframes have a strict CSP (`style-src 'self'`, no `'unsafe-inline'`, no bare module specifiers). Raw HTML with inline `<style>` and `<script type="module">import { view } from '@forge/bridge'</script>` will fail with:
  - `Applying inline style violates the following Content Security Policy directive ...`
  - `Uncaught TypeError: Failed to resolve module specifier "@forge/bridge"`
- Fix: write source HTML/JS/CSS in `src-ui/{macro,editor}/`, bundle with Vite (`build.target: 'es2022'` so top-level `await` survives), output to `built/{macro,editor}/`. Manifest `resource:` paths point at `built/`.
- Vite extracts inline `<style>` into an external CSS file (CSP-clean) and resolves bare imports against `node_modules` so `@forge/bridge` gets bundled in.

### Macro instance identity (skip the config dance)

- We avoid the macro config dialog entirely. Use `ctx.extension.localId` (stable per-instance ID Forge assigns) as the storage key:
  ```js
  const ctx = await view.getContext();
  const id  = ctx.extension?.localId;
  await invoke('wavedrom-load', { id });
  ```
- Trying to mint a UUID inside `defaultConfig` and read it from `ctx.extension.config.uuid` does **not** work unless the user submits a config form — which we don't render.

### Modal flow

- `new Modal({ resource: '<editor-resource-key>', context: { ... } }).open()` is the right API for inline-edit modals. Do **not** use `view.submit(...)` from the modal — that's the config submission flow, not the modal close flow.
- Inside the modal, the passed `context` is at `ctx.extension.modal.context` (in current Forge). Earlier docs suggested other paths; defensively try multiple.
- Modal closes with `view.close()`. The opener receives the close event via the `onClose` callback declared at `new Modal({...})` construction.

### iframe sizing

- Custom UI iframes don't auto-size to content. Call `view.resize()` after each render so the host can grow the iframe to fit the SVG. Otherwise the macro looks clipped and buttons positioned at the corner may sit off-screen.

### Install / deploy workflow

- After modifying module shape (adding/removing resolvers, changing resource paths), re-install with `forge install --upgrade -s <site> -p Confluence -e development --confirm-scopes --non-interactive`. `forge deploy` alone won't refresh the macro module wiring.
- `forge login` / `forge register` / `forge create` are all interactive — must run in a real TTY (e.g. Terminal.app), not the Claude Code bash sandbox.
- `forge logs -s 30m` shows runtime invocation errors. If logs are empty, the resolver is not being invoked at all (manifest binding problem, not function code problem).

## Downloads
- Use **semantic versioning** in download zip filenames (e.g. `Wavedrom-Editor-v0.3.0.zip`).
- Keep a short `CHANGELOG.md` at the project root listing what changed per version. Append a new entry when bumping.
