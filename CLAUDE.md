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

## Downloads
- Use **semantic versioning** in download zip filenames (e.g. `Wavedrom-Editor-v0.3.0.zip`).
- Keep a short `CHANGELOG.md` at the project root listing what changed per version. Append a new entry when bumping.
