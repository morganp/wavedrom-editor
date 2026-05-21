# WaveDrom — Confluence Data Center / Server plugin (P2)

A Java (Atlassian SDK / P2) plugin that ships the same WaveDrom macro for
self-hosted Confluence. The editor source is shared with the Cloud Forge app
and the VS Code extension — only the host shell differs.

## Layout

```
packages/confluence-dc/
├─ atlassian-plugin.xml      # plugin descriptor
├─ pom.xml                   # Maven build (Atlassian SDK)
├─ src/main/java/.../        # Macro renderer + edit servlet (TODO)
└─ src/main/resources/
   ├─ bundle/                # built embed assets dropped here
   ├─ dialog.js              # AUI dialog2 launcher → mounts the embed
   └─ images/                # macro icons
```

## Storage

Same as Cloud: the WaveDrom JSON is stored in the macro body. Confluence's
storage format preserves it through versioning, restricting, and
exporting (PDF/Word) just like other macros.

For large diagrams (>32 KB) the macro stores a content-property UUID
referring to a `ContentEntityObject` stored property.

## Edit flow

1. `WavedromMacro.execute` renders the inline SVG by reading the JSON body
   and calling a JVM port of `wave-render.js` (Phase 1 stub: server-side
   render via a small Nashorn/GraalJS evaluator, or just embed the JS at
   render time).
2. The macro outputs an `aui-dialog2` trigger button. On click `dialog.js`
   opens a modal, mounts the embed bundle, passes the current JSON as
   `initial`. Save calls `view.submit({ body })` back into the macro.

## Build

```sh
atlas-package      # → target/wavedrom-editor-0.4.0.jar
atlas-run          # local Confluence with the plugin loaded
```

## Versions supported

Targeted at Confluence DC ≥ 7.x with `aui-dialog2` available. Older Server
releases (≤ 6.x) would need an `aui-dialog` (v1) fallback.

## Why a separate package

Forge Custom UI (Cloud) and P2 (Data Center / Server) are two different
hosting models with two different deploy / install paths. Sharing one
package would force one to pull the other's tooling at build time — keeping
them split, each pulling the **shared embed bundle**, keeps releases
independent.
