# Deployment guide

We ship **four** artifacts from this repo. Each has a different distribution
channel. They share one editor source — only the host shell and the
packaging step differ.

| Artifact                       | Channel                           | Audience                          |
|--------------------------------|-----------------------------------|-----------------------------------|
| 1 · Standalone web app         | Static hosting (GitHub Pages, S3, internal CDN) | Anyone with a browser             |
| 2 · VS Code extension          | VS Code Marketplace + OpenVSX     | VS Code / Cursor / VSCodium users |
| 3 · Confluence Cloud (Forge)   | Atlassian Marketplace             | Confluence Cloud customers        |
| 4 · Confluence Data Center     | Atlassian Marketplace (paid DC tier) | Self-hosted Confluence            |

---

## 0 · Prerequisite — production build

Today the editor loads React + Babel from `unpkg.com` and transpiles JSX in
the browser. That's fine for local development but **must not** ship — it's
slow, network-dependent, and forbidden by VS Code webview CSP and Confluence
Custom UI CSP.

Before any of the deployments below works, set up a production build:

```sh
# one-time
npm init -y
npm install --save-dev vite @vitejs/plugin-react react@18 react-dom@18
```

Add a `vite.config.js` that produces:
- `dist/standalone/index.html` — the editor with no host (artifact 1)
- `dist/embed/embed.html` + `embed-boot.js` + chunked editor JS/CSS
  (used by artifacts 2–4)

```sh
npm run build          # produces dist/
```

After this, every artifact below pulls from `dist/embed/`.

---

## 1 · Standalone web app

Plain static site. Drop `dist/standalone/` on any HTTP server.

### GitHub Pages (recommended for OSS)
```yaml
# .github/workflows/pages.yml
on: { push: { branches: [main] } }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci && npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist/standalone }
      - uses: actions/deploy-pages@v4
```

Result: `https://<org>.github.io/wavedrom-editor/`.

### Other static hosts
- **Cloudflare Pages / Netlify / Vercel**: point at the repo, build cmd
  `npm run build`, publish directory `dist/standalone`.
- **S3 + CloudFront**: `aws s3 sync dist/standalone s3://bucket/`.
- **Internal nginx**: copy `dist/standalone` to `/var/www/wavedrom/`.

No backend, no env vars, no cookies.

---

## 2 · VS Code extension

### Build
```sh
# bundle the embed assets into the extension's media/ folder
cp -r dist/embed/* packages/vscode-extension/media/

cd packages/vscode-extension
npm install
npm run compile          # tsc → out/extension.js
npm run package          # vsce → wavedrom-editor-0.4.0.vsix
```

### Publish
1. **One-time setup**:
   ```sh
   npm install -g @vscode/vsce
   vsce login <publisher-id>     # uses a personal access token
   ```
   Create the publisher at https://marketplace.visualstudio.com/manage.

2. **Publish to VS Code Marketplace**:
   ```sh
   vsce publish               # bumps + uploads
   # or
   vsce publish minor         # 0.4.0 → 0.5.0
   ```

3. **Publish to OpenVSX** (so Cursor, VSCodium, code-server users get it):
   ```sh
   npx ovsx publish wavedrom-editor-0.4.0.vsix -p $OVSX_TOKEN
   ```

### Distribute the `.vsix` directly
For private deployment without the Marketplace:
```sh
code --install-extension wavedrom-editor-0.4.0.vsix
```
or drop it on a shared drive / internal package server.

### Automated release
```yaml
# .github/workflows/vscode.yml
on: { push: { tags: ['v*'] } }
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci && npm run build
      - run: cp -r dist/embed/* packages/vscode-extension/media/
      - run: cd packages/vscode-extension && npm ci && npm run package
      - run: cd packages/vscode-extension && npx vsce publish -p ${{ secrets.VSCE_TOKEN }}
      - run: cd packages/vscode-extension && npx ovsx publish -p ${{ secrets.OVSX_TOKEN }}
```

---

## 3 · Confluence Cloud (Forge)

### Prerequisites
```sh
npm install -g @forge/cli
forge login                # browser-based Atlassian account login
```

### One-time app registration
```sh
cd packages/confluence-forge
forge register             # creates the ari:cloud:ecosystem::app/... in manifest.yml
```

### Build + deploy
```sh
# bundle the embed assets
cp -r ../../dist/embed/* resources/macro/bundle/
cp -r ../../dist/embed/* resources/editor/bundle/

# deploy to the dev environment
forge deploy               # pushes the app to Atlassian's runtime
forge install              # installs on your dev Confluence site
```

### Promote to production
Forge has three environments: `development`, `staging`, `production`.
```sh
forge deploy --environment production
forge install --site customer.atlassian.net --environment production
```

### List on Atlassian Marketplace
1. Make the app public:
   ```sh
   forge install --upgrade
   ```
2. Open https://marketplace.atlassian.com/manage and create a listing:
   - Upload the same `manifest.yml`-bound app.
   - Add screenshots (from `dist/standalone` or a recorded demo).
   - Choose **free** or **paid via Atlassian** pricing.
3. Atlassian review takes 5–10 business days. Updates after that are pushed
   with `forge deploy --environment production`.

### Automated deploy
```yaml
# .github/workflows/forge.yml
on: { push: { tags: ['v*'] } }
jobs:
  forge-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci && npm run build
      - run: |
          cp -r dist/embed/* packages/confluence-forge/resources/macro/bundle/
          cp -r dist/embed/* packages/confluence-forge/resources/editor/bundle/
      - run: npm install -g @forge/cli
      - run: cd packages/confluence-forge && forge deploy --environment production --non-interactive
        env: { FORGE_EMAIL: ${{ secrets.FORGE_EMAIL }}, FORGE_API_TOKEN: ${{ secrets.FORGE_TOKEN }} }
```

---

## 4 · Confluence Data Center / Server

### Prerequisites
```sh
# Atlassian SDK — bundles Maven + a local Confluence
brew install atlassian-sdk        # macOS
# or: https://developer.atlassian.com/server/framework/atlassian-sdk/install-the-atlassian-sdk-on-a-linux-or-mac-system/
```

### Build
```sh
# bundle the embed assets
cp -r dist/embed/* packages/confluence-dc/src/main/resources/bundle/

cd packages/confluence-dc
atlas-package        # → target/wavedrom-editor-0.4.0.jar
```

### Test locally
```sh
atlas-run            # starts Confluence on http://localhost:1990/confluence
                     # plugin is loaded with quick-reload enabled
```

### Distribute
Three paths:

1. **Atlassian Marketplace (paid DC tier)** — same listing as the Cloud
   app, plus a separate "Data Center" deliverable:
   - Upload the `.jar` (or `.obr`).
   - Pass [Data Center Approved](https://developer.atlassian.com/platform/marketplace/data-center-apps-on-the-marketplace/) review (clustering, perf, accessibility).
   - Atlassian handles licensing + payments.

2. **Direct install** — admins upload the `.jar` via *Confluence
   Administration → Manage apps → Upload app*. For internal-only
   deployments.

3. **Private update site** — host the `.jar` on an internal URL and have
   admins point Confluence's app updater at it.

### Automated build
```yaml
# .github/workflows/dc.yml
on: { push: { tags: ['v*'] } }
jobs:
  dc-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci && npm run build
      - run: cp -r dist/embed/* packages/confluence-dc/src/main/resources/bundle/
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '11' }
      - run: cd packages/confluence-dc && mvn -B package
      - uses: actions/upload-artifact@v4
        with:
          name: wavedrom-dc-jar
          path: packages/confluence-dc/target/*.jar
```

(Atlassian Marketplace doesn't expose a CLI for DC uploads — the final
"upload to listing" step stays manual.)

---

## Release cadence

A single git tag triggers all four pipelines:

```sh
# in repo root
npm version minor         # bumps package.json + creates the tag
git push --follow-tags
```

The four pipelines pull the tag, build the embed once, and ship to their
respective channels. Versions stay in lockstep — `Wavedrom-Editor-v0.5.0.zip`,
`wavedrom-editor-0.5.0.vsix`, Forge `v0.5.0`, DC `wavedrom-editor-0.5.0.jar`.

---

## Cost summary

| Artifact         | Hosting cost                       | Marketplace cut          |
|------------------|------------------------------------|--------------------------|
| Standalone       | ~$0 (GitHub Pages / Cloudflare)    | n/a                      |
| VS Code          | $0 (Marketplace is free)           | 0%                       |
| Confluence Cloud | $0 (Forge is hosted by Atlassian)  | 15% if paid              |
| Confluence DC    | $0 build infra; $$ if listed       | 15% if paid              |

The cheapest first launch is **standalone + VS Code**: zero infrastructure
and zero approval lead time. Confluence adds ~1–2 weeks of marketplace
review on first listing.
