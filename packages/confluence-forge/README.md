# WaveDrom — Confluence Forge app (Cloud)

A Confluence Cloud macro that embeds a WaveDrom timing diagram and opens a
visual editor on double-click — same model as draw.io.

## Layout

```
packages/confluence-forge/
├─ manifest.yml                        # Forge module declarations
├─ src/index.js                        # Forge functions (default config)
├─ resources/
│  ├─ macro/index.html                 # inline view + "Edit" button
│  ├─ editor/index.html                # full-screen edit modal
│  └─ icons/                           # macro icon assets
└─ build/                              # bundled embed assets (gitignored)
```

## Storage

The macro body holds the WaveDrom JSON as a string. Page versioning gives us
last-writer-wins conflict resolution for free, with diff visibility in page
history.

For diagrams larger than ~32 KB we fall back to Forge `storage.entity` keyed
by a UUID stored in the macro body.

## View → edit flow

1. **macro/index.html** — read-only inline view.
   - Renders the JSON as SVG via a hidden headless `WavedromEditor.exportSvg()`
     instance (stub today; in Phase 1 this gets a real renderer).
   - Shows a corner "✎ Edit" button on hover.
2. **editor/index.html** — full editor modal.
   - Hosts the same React app the rest of the repo uses.
   - On submit, calls `view.submit({ body: jsonText })` so Forge persists the
     updated macro body in the page version.

## Theming

`view.getContext().themeState.colorMode` is read on load and mapped to a
`data-theme="dark"|"light"` attribute on `<html>`. The editor's CSS already
uses tokens (`--ink`, `--bg`, `--accent`, ...) so the theme switch is one
CSS block.

## Build

```sh
# build the embed bundle into resources/{macro,editor}/bundle/
npm run -w packages/confluence-forge build

# Forge deploy
forge deploy
forge install
```

## Limitations / risks

- **Custom UI iframe CSP**: editor must be fully self-contained in
  `resources/editor/`. No CDN scripts.
- **Forge invocation quotas**: the editor is purely client-side; we only hit
  backend functions for the default-spec on macro insert. Saves go through
  `view.submit` which costs zero invocations.
- **PDF / Word export**: Confluence rasterises macros server-side. We need a
  fast headless `exportSvg()` path for export reliability — see Phase 2
  roadmap.
