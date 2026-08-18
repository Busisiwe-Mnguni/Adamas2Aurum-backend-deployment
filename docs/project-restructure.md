# Project Structure Consolidation

**Date:** 2026-08-17
**Branch:** `feat/project-structure`
**Scope:** Relocate merged-branch "Better Auth" files into the canonical `app/src/` structure.

---

## Context

Two branches were merged into `feat/project-structure`:

- **Better Auth branch** — Google OAuth + email/password, dark theme, served from a flat layout at the repository root (`server.js`, `src/auth.js`, `public/*`).
- **PIN-auth branch** — PIN-based session auth with a Leaflet map/events dashboard, light theme, organized under `app/src/frontend` + `app/src/backend`.

The `README.md` and root `package.json` both designate `app/src/frontend` + `app/src/backend` as the canonical structure (all root scripts delegate there). A partial migration had already moved five Better Auth files (`build.js`, `client-entry.js`, `migrate.js`, `dashboard.html`, `reset-password.html`) into `app/src/`, but with **stale internal paths**, and six more Better Auth files still sat at the repository root.

**Decision:** keep both implementations, relocate the root-level Better Auth files into `app/src/` without overwriting the existing PIN-auth files (disambiguated by filename), fix all stale cross-references so the Better Auth slice is internally consistent, and trim the root `package.json` to orchestrator-only dependencies. No source logic was merged or deleted — the two auth implementations coexist for later reconciliation.

---

## Changes made

### 1. File moves (`git mv`)

Six root-level Better Auth files were relocated into `app/src/`. Where a destination name already existed with different PIN-auth content, the moved file was renamed to disambiguate.

| From (root)            | To                                         |
| ---------------------- | ------------------------------------------ |
| `server.js`            | `app/src/backend/server-better-auth.js`    |
| `src/auth.js`          | `app/src/backend/better-auth.js`           |
| `public/index.html`    | `app/src/frontend/pages/sign-in.html`      |
| `public/css/style.css` | `app/src/frontend/css/auth.css`            |
| `public/js/auth.js`    | `app/src/frontend/js/auth.js`              |
| `.env.example`         | `app/src/backend/.env.better-auth.example` |

Naming split introduced by the moves:

- `style.css` = PIN-auth light theme; `auth.css` = Better Auth dark theme.
- `server.js` = PIN-auth server (active `start:backend`/`dev:backend` target); `server-better-auth.js` = Better Auth server (not wired into any root npm script).
- `routes/auth.js` = PIN-auth route; `better-auth.js` = Better Auth configuration.

### 2. Stale-reference fixes

Cross-references inside the Better Auth slice were updated so the slice is internally consistent under its new locations.

- **`app/src/backend/server-better-auth.js`**
     - `import { auth } from "./src/auth.js"` → `"./better-auth.js"`
     - `express.static(path.join(__dirname, "public"))` → `path.join(__dirname, "../frontend")` (serves `app/src/frontend` so `/css/auth.css`, `/js/auth.js`, `/js/auth-client.bundle.mjs` resolve)
     - Root fallback `sendFile` → `path.join(__dirname, "../frontend", "pages", "sign-in.html")`
- **`app/src/backend/utils/migrate.js`** — `import { auth } from "../../../../src/auth.js"` → `"../better-auth.js"`
- **`app/src/backend/scripts/build.js`**
     - `entryPoints: ["src/client-entry.js"]` → `["./client-entry.js"]`
     - `outfile: "public/js/auth-client.bundle.mjs"` → `"../../frontend/js/auth-client.bundle.mjs"`
     - Log message updated to the new output path.
- **`app/src/frontend/pages/sign-in.html`, `dashboard.html`, `reset-password.html`** — stylesheet `href="/css/style.css"` → `href="/css/auth.css"` (the renamed dark-theme stylesheet).

Files with no internal relative references (`better-auth.js`, `client-entry.js`, `auth.css`, `js/auth.js`) required no edits.

### 3. Dependency relocation

- **Root `package.json`** — trimmed to orchestrator-only. `dependencies` now contains only `serve`; `better-auth`, `dotenv`, `express`, `mysql2` were removed (these belong with the code that imports them). `devDependencies` (`jest`, `jest-environment-jsdom`, `prettier`) and all `scripts` are unchanged. (This trim was already present in `HEAD`; the worktree was realigned to it.)
- **`app/src/backend/package.json`** — added `"better-auth": "^1.3.4"` to `dependencies` and a `devDependencies` block with `"esbuild": "^0.25.0"` (build-time, used by `scripts/build.js` and previously undeclared anywhere). `npm install --prefix app/src/backend` installed both packages.

### 4. `.gitignore`

The Better Auth client-bundle ignore rules were repointed from the old flat path to the new output location:

- `public/js/auth-client.bundle.mjs` → `app/src/frontend/js/auth-client.bundle.mjs`
- `public/js/auth-client.bundle.mjs.map` → `app/src/frontend/js/auth-client.bundle.mjs.map`

### 5. Directory cleanup

The now-empty root stray directories were removed: `src/`, `public/`, `public/css/`, `public/js/`. No build artifacts were present on disk.

### 6. Formatting

`npm run format` (Prettier) was run across the repository. `npm run format:check` now passes. **Note:** this also reformatted a number of pre-existing `app/src/` files that were not previously Prettier-compliant (e.g. `console.js`, `main.js`, `console.html`), so the staged diff is larger than the restructuring alone.

---

## Verification

- `node --check` passed for all moved/edited JavaScript files (`server-better-auth.js`, `better-auth.js`, `utils/migrate.js`, `scripts/build.js`, `frontend/js/auth.js`).
- `npm run format:check` — **pass** (all matched files use Prettier code style).
- `npm test` — frontend project passes (`app/src/frontend/js/geolocation.test.js`); backend `app/src/backend/main.test.js` **fails** with `Cannot find module 'vitest'`. This is a **pre-existing** jest/vitest runner mismatch (the test imports `vitest` while the configured runner is `jest`) and is **not** caused by this restructuring — the import predates the work and no test logic was changed.
- A repository-wide search confirmed no remaining references to the old root paths (`public/`, `src/auth.js`, `src/client-entry`) or to `/css/style.css` inside the Better Auth pages. The only `/css/style.css` references are the PIN-auth pages' correct `../css/style.css` links to the light theme.

---

## Resulting layout

```
app/src/backend/
  server.js                 # PIN-auth server (canonical, active)
  server-better-auth.js     # Better Auth server (moved from ./server.js)
  better-auth.js            # Better Auth config (moved from ./src/auth.js)
  .env.better-auth.example  # moved from ./.env.example
  .env.example              # PIN-auth env template (unchanged)
  scripts/build.js          # Better Auth client bundler (paths fixed)
  scripts/client-entry.js   # Better Auth browser entry (no refs to fix)
  utils/migrate.js          # Better Auth DB migration (import fixed)
  routes/auth.js            # PIN-auth route (unchanged)
  ...
app/src/frontend/
  index.html                # PIN landing page (unchanged)
  css/style.css             # light theme (unchanged)
  css/auth.css              # Better Auth dark theme (moved + renamed)
  js/auth.js                # Better Auth client logic (moved)
  pages/sign-in.html        # Better Auth sign-in (moved + renamed)
  pages/dashboard.html      # Better Auth dashboard (paths fixed)
  pages/reset-password.html # Better Auth reset page (paths fixed)
  ...
```

The root directory now contains only orchestration/config files (`package.json`, `package-lock.json`, `.gitignore`, `.prettierrc.yaml`, `.prettierignore`, `README.md`, `docs/`, `app/`, `node_modules/`). No `server.js`, `src/`, or `public/` remain at the root.

---

## Known follow-ups (not addressed — left for later reconciliation)

1. Decide which authentication implementation becomes canonical (PIN session vs. Better Auth), or port Google OAuth from the Better Auth slice into the PIN-auth server.
2. Resolve the `main.test.js` jest/vitest runner mismatch (install `vitest` and run tests under it, or rewrite the test to use jest globals).
3. The Better Auth server (`server-better-auth.js`) serves `app/src/frontend` as its static root, which also exposes the PIN-auth light-theme assets. This is an interim arrangement and should be revisited when reconciling the two frontends.
4. Nothing was committed — all changes are staged for review.

---

## AI Declaration

This document was authored by **Qoder**, an autonomous coding agent, on **2026-08-17**, while operating in the `Adamas2Aurum` repository on the `feat/project-structure` branch. It was generated directly from the actions taken during the session (file moves, edits, dependency changes, and verification commands) and reflects the actual final state of the working tree at the time of writing.

Qoder does not disclose the underlying language model, provider, model family, version, or training data that powers it; accordingly, no such identifying information is recorded here. The document should be treated as agent-generated and verified against the repository history before being relied upon.
