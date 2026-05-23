#!/usr/bin/env bash
# build-web-zip.sh — build the standalone web bundle and zip it for distribution.
#
# Output: Wavedrom-Editor-v<version>.zip at repo root.
# Version is read from packages/vscode-extension/package.json (canonical source per CLAUDE.md).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

VERSION="$(node -p "require('./packages/vscode-extension/package.json').version")"
if [[ -z "${VERSION}" || "${VERSION}" == "undefined" ]]; then
  echo "ERROR: could not read version from packages/vscode-extension/package.json" >&2
  exit 1
fi

ZIP_NAME="Wavedrom-Editor-v${VERSION}.zip"
DIST_DIR="dist/standalone"

echo "→ building standalone bundle (vite build)"
npm run --silent build:standalone

if [[ ! -d "$DIST_DIR" ]]; then
  echo "ERROR: $DIST_DIR not found after build" >&2
  exit 1
fi

# Sanity check: index.html and at least one asset must exist.
if [[ ! -f "$DIST_DIR/index.html" ]] || [[ -z "$(ls -A "$DIST_DIR/assets" 2>/dev/null)" ]]; then
  echo "ERROR: $DIST_DIR is missing index.html or assets/" >&2
  exit 1
fi

echo "→ zipping $DIST_DIR → $ZIP_NAME"
rm -f "$ZIP_NAME"

# Zip with a top-level folder matching the zip name (minus .zip) so unzip
# produces Wavedrom-Editor-v<version>/index.html, not loose files in cwd.
STAGE_DIR="$(mktemp -d)"
TOP_NAME="Wavedrom-Editor-v${VERSION}"
cp -R "$DIST_DIR" "$STAGE_DIR/$TOP_NAME"

(cd "$STAGE_DIR" && zip -rq "$REPO_ROOT/$ZIP_NAME" "$TOP_NAME")
rm -rf "$STAGE_DIR"

SIZE="$(du -h "$ZIP_NAME" | awk '{print $1}')"
echo "✓ $ZIP_NAME ($SIZE)"
