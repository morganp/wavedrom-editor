# Project notes

## Downloads
- Use **semantic versioning** in download zip filenames (e.g. `Wavedrom-Editor-v0.3.0.zip`, `Wavedrom-Editor-v1.0.0.zip`).
- Bump the version appropriately for each new download:
  - **MAJOR** — breaking changes to the JSON schema, file layout, or persisted state shape.
  - **MINOR** — new user-visible features (new panels, new interactions, new tweaks).
  - **PATCH** — bug fixes, visual polish, refactors that don't change behavior.
- Keep a short `CHANGELOG.md` at the project root listing what changed per version. Append a new entry when bumping.
