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

The webview hosts the same React app that lives at the repo root. The build
step compiles those files to plain JS (no Babel-in-browser, pinned React) and
copies them into `media/`, then `tsc` compiles the extension itself.

```sh
# from repo root
npm run -w packages/vscode-extension build:webview   # → media/*.js
npm run -w packages/vscode-extension compile         # → out/extension.js
npm run -w packages/vscode-extension package         # → wavedrom-editor-0.4.0.vsix
```

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
