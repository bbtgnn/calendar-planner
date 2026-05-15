# Technology Stack

**Analysis Date:** 2026-05-15

## Languages

**Primary:**
- TypeScript 6.0.3 — All application logic under `src/` (`*.ts`, `*.svelte` with `<script lang="ts">`)
- Svelte 5.55.4 — UI components and runes-based reactivity in `src/routes/**/*.svelte` and `src/routes/class/[classId]/SemesterMap.svelte`

**Secondary:**
- HTML — Shell template in `src/app.html`
- JavaScript — Config only: `svelte.config.js` (ESM)

## Runtime

**Environment:**
- Browser (client-only SPA). SvelteKit SSR and prerender are explicitly disabled in `src/routes/+layout.ts` (`ssr = false`, `prerender = false`).
- No Node server endpoints: no `src/hooks.server.ts`, no `+server.ts` routes detected.

**Package Manager:**
- Bun — Required per `README.md`; install and scripts use `bun`
- Lockfile: `bun.lock` present (lockfileVersion 1)

## Frameworks

**Core:**
- SvelteKit 2.57.1 — Routing, layouts, `load` functions, `$app/navigation` invalidation (`src/routes/`, `src/lib/kit/`)
- Svelte 5.55.4 — Component framework
- Vite 8.0.9 — Dev server and production bundler (`vite.config.ts`)

**Data:**
- Dexie 4.4.2 — IndexedDB wrapper; schema and migrations in `src/lib/db/client.ts`

**Testing:**
- Vitest 4.1.4 — Unit tests (`vite.config.ts` test project, `src/**/*.test.ts`)
- fake-indexeddb 6.2.5 — In-memory IndexedDB for Node test environment (`src/test/setup.ts`)

**Build/Dev:**
- `@sveltejs/adapter-static` 3.0.10 — Static SPA output to `build/` with `index.html` fallback (`svelte.config.js`)
- `@sveltejs/vite-plugin-svelte` 7.0.0 — Svelte preprocessing in Vite
- svelte-check 4.4.6 — Type and Svelte diagnostics (`bun run check`)

**Installed but unused at runtime:**
- `@sveltejs/adapter-auto` 7.0.1 — Listed in `package.json` devDependencies; `svelte.config.js` uses `adapter-static` instead

## Key Dependencies

**Critical:**
- `dexie` 4.4.2 — Persistent storage for classes, students, lessons, absences (`src/lib/db/client.ts`, repos under `src/lib/repos/`)

**Infrastructure (dev/tooling only):**
- `@sveltejs/kit`, `vite`, `typescript`, `vitest` — Build, typecheck, test pipeline
- GitNexus — Code intelligence indexed for agents (see `AGENTS.md`, `CLAUDE.md`); not a runtime dependency

**Browser APIs (no npm package):**
- `crypto.randomUUID()` — Primary keys in `src/lib/repos/classes.repo.ts`, `src/lib/repos/lessons.repo.ts`, `src/lib/repos/students.repo.ts`
- `localStorage` — Last-selected class id (`src/lib/preferences/activeClass.ts`)
- `FileReader` + `<input type="file">` — Roster import from `.txt` / `.csv` (`src/routes/class/[classId]/students/+page.svelte`)
- `window.prompt` / `window.confirm` — Class CRUD confirmations (`src/routes/+layout.svelte`, lesson/student delete flows)

## Configuration

**Environment:**
- No `.env` or `.env.example` files in the repository
- `.gitignore` ignores `.env` and `.env.*` (allows `.env.example` / `.env.test` if added later)
- Application code does not reference `import.meta.env` or `process.env` under `src/`

**Build:**
- `svelte.config.js` — Static adapter, SPA fallback `index.html`
- `vite.config.ts` — SvelteKit plugin; Vitest with Node environment and `src/test/setup.ts`
- `tsconfig.json` — Strict TypeScript, extends `.svelte-kit/tsconfig.json`, `moduleResolution: "bundler"`
- Path alias `$lib` → `src/lib/` (SvelteKit default)

**App metadata:**
- `package.json` name: `lesson-planner` (private, version `0.0.1`, `"type": "module"`)

## Platform Requirements

**Development:**
- Bun for `bun install`, `bun run dev`, `bun run test`, `bun run check`
- Modern browser with IndexedDB, `localStorage`, and Web Crypto `randomUUID`

**Production:**
- Static file hosting only (any CDN, nginx, GitHub Pages, Netlify, Vercel static, etc.)
- Build artifact: `build/` directory after `bun run build`
- SPA routing: server must serve `index.html` for unknown paths (configured via adapter `fallback: 'index.html'`)
- No backend, database server, or environment secrets required for core app behavior

---

*Stack analysis: 2026-05-15*
