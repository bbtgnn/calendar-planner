# Technology Stack

**Analysis Date:** 2026-05-15

## Languages

**Primary:**
- TypeScript `^6.0.2` — All application logic under `src/` (`.ts` modules, Svelte `<script lang="ts">` in `.svelte` routes and components)
- Svelte 5 — UI in `src/routes/**/*.svelte` and `src/routes/class/[classId]/SemesterMap.svelte`; uses runes (`$props`, `$state`, `$derived`)

**Secondary:**
- JavaScript — SvelteKit config in `svelte.config.js` (ESM); GSD tooling under `.cursor/get-shit-done/` (not part of the app runtime)
- HTML — Shell in `src/app.html`

## Runtime

**Environment:**
- Browser (client-only SPA). Root layout disables SSR: `export const ssr = false` in `src/routes/+layout.ts`
- Node.js — Used for dev/build/test tooling (Vitest `environment: 'node'` in `vite.config.ts`); no Node server in production

**Package Manager:**
- Bun `1.3.12` (documented in `README.md`; `test` script invokes `bun run test:unit`)
- Lockfile: `bun.lock` present
- `.npmrc`: `engine-strict=true` (enforces declared engine constraints when using npm-compatible clients)

## Frameworks

**Core:**
- SvelteKit `^2.57.0` — Routing, loads, navigation (`$app/navigation`, `$app/state`, `$app/paths`)
- Svelte `^5.55.2` — Components and reactivity
- Vite `^8.0.7` — Dev server and production bundling via `@sveltejs/vite-plugin-svelte` `^7.0.0`

**Testing:**
- Vitest `^4.1.3` — Unit tests; config merged in `vite.config.ts` (`test.projects` with `environment: 'node'`)
- `fake-indexeddb` `^6.2.5` — Polyfills IndexedDB in tests (`src/test/setup.ts` imports `fake-indexeddb/auto`)

**Build/Dev:**
- `@sveltejs/adapter-static` `^3.0.10` — Static export to `build/` with SPA fallback `index.html` (`svelte.config.js`)
- `svelte-check` `^4.4.6` — Type-check Svelte + TS (`bun run check`)
- `@sveltejs/adapter-auto` `^7.0.1` — Listed in devDependencies but **not** wired in `svelte.config.js` (static adapter is active)

## Key Dependencies

**Critical:**
- `dexie` `^4.4.2` — IndexedDB ORM; schema and migrations in `src/lib/db/client.ts` (`LessonPlannerDB`, database name `lesson-planner-db`)

**Infrastructure:**
- None beyond Dexie — No HTTP client, auth SDK, or cloud database in `package.json` dependencies

**Dev-only (quality):**
- `typescript`, `svelte-check`, `vitest`, `fake-indexeddb`, SvelteKit adapters

## Configuration

**Environment:**
- No `.env`, `.env.example`, or `import.meta.env` usage in `src/`
- `.gitignore` allows `.env.example` / `.env.test` but none are committed; app does not require secrets at runtime

**Build:**
- `vite.config.ts` — SvelteKit plugin + Vitest project extending same config
- `svelte.config.js` — `adapter-static` with `fallback: 'index.html'`, `vitePreprocess()`
- `tsconfig.json` — Extends `.svelte-kit/tsconfig.json`; `strict: true`, `moduleResolution: "bundler"`, `rewriteRelativeImportExtensions: true`
- Path alias: `$lib` → `src/lib` (SvelteKit default)

**App behavior flags:**
- `src/routes/+layout.ts`: `ssr = false`, `prerender = false` — Fully client-rendered; data loaded in browser via Dexie in `load` functions

## Platform Requirements

**Development:**
- Bun for install and scripts (`README.md`)
- Modern browser with IndexedDB, `localStorage`, `crypto.randomUUID`, and `FileReader` (roster import in `src/routes/class/[classId]/students/+page.svelte`)

**Production:**
- Static file hosting only — `bun run build` → `build/` directory
- SPA routing: host must serve `index.html` for unknown paths (configured via adapter `fallback`)
- `.gitignore` lists `.vercel`, `.netlify`, `.wrangler` as possible output dirs; no platform config files in repo — deployment target is generic static hosting

**Styling:**
- Component-scoped `<style>` blocks in Svelte files (no Tailwind, PostCSS, or global CSS package)
- Favicon: `src/lib/assets/favicon.svg` (imported from `src/routes/+layout.svelte`)

---

*Stack analysis: 2026-05-15*
