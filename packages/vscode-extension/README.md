# WaveDrom Visual Editor — VS Code extension

Visual editor for WaveDrom timing-diagram JSON files (`*.wavedrom.json`,
`*.wd.json`) and fenced ```wavedrom``` blocks inside Markdown.

## Layout

```
packages/vscode-extension/
├─ package.json         # extension manifest (custom editor + commands)
├─ tsconfig.json
├─ src/
│  └─ extension.ts      # CustomTextEditorProvider + Markdown CodeLens
└─ media/               # built embed bundle goes here (see Build)
```

## Build

The webview hosts the React app from the repo root compiled to a plain IIFE bundle.
`build:webview` expects `dist/embed.iife.js` to already exist.

```sh
# from repo root — build the shared embed bundle first
npm run build:embed

# then package the extension
cd packages/vscode-extension
npm run package          # → wavedrom-editor-<version>.vsix
```

`npm run package` triggers `vscode:prepublish` automatically:
1. `build:webview` copies `dist/embed.iife.js` → `media/embed.js` and `embed.css`
2. `compile` runs `tsc` → `out/extension.js`
3. `vsce package` produces the `.vsix`

Install via **Extensions → ... → Install from VSIX**.

## Two activation paths

### 1. Open a `*.wavedrom.json` file
The custom editor (`viewType: wavedrom.editor`) replaces the default text
editor. *Reopen With… → Text* is always available for raw JSON.

### 2. Edit a fenced block in Markdown
A CodeLens "✎ Edit visually" appears above each:

````md
```wavedrom
{ "signal": [...] }
```
````

Clicking it opens a side-by-side webview. Saving writes the new JSON back
into the same range of the markdown file.

## Theme

The webview maps VS Code's CSS custom properties (`--vscode-editor-*`) to the
editor's own tokens (`--ink`, `--bg`, `--accent`, ...) so the diagram follows
light / dark / high-contrast themes automatically.

## Persistence

Saves go through the normal `vscode.WorkspaceEdit` pipeline, so the file's
dirty state, source control, and undo stack all behave as expected.
