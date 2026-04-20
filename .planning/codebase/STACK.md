# Technology Stack

**Analysis Date:** 2026-04-20

## Languages

**Primary:**
- TypeScript (strict, `moduleResolution: "bundler"`) — application logic in `src/**/*.ts`, load functions, tests
- Svelte — UI in `src/**/*.svelte` (Svelte 5 runes / component syntax per project version)

**Secondary:**
- JavaScript — `svelte.config.js` (Kit config)
- HTML — `src/app.html` shell

## Runtime

**Environment:**
- **Browser** — primary execution: `src/routes/+layout.ts` sets `ssr = false` and `prerender = false`, so the app is a client-only SPA
- **Node.js** — used implicitly by Vite during `bun run dev` / `bun run build` (Vite dev server and build tooling)

**Package Manager:**
- Bun — documented in `README.md`; `package.json` script `test` invokes `bun run test:unit`
- Lockfile: `bun.lock` present

## Frameworks

**Core:**
- SvelteKit `^2.57.0` — routing, `$app/*` imports, Vite integration (`@sveltejs/kit`)
- Svelte `^5.55.2` — components and stores (e.g. `src/lib/stores/toast.ts` uses `svelte/store`)
- Vite `^8.0.7` — bundler and dev server (`vite.config.ts`, `@sveltejs/vite-plugin-svelte`)

**Testing:**
- Vitest `^4.1.3` — unit tests; config embedded in `vite.config.ts` under `test.projects` (Node environment, `src/test/setup.ts`)

**Build/Dev:**
- `@sveltejs/adapter-static` `^3.0.10` — static output; configured in `svelte.config.js` with `fallback: 'index.html'` for SPA routing
- `svelte-check` `^4.4.6` — type and Svelte diagnostics (`bun run check`)

## Key Dependencies

**Critical:**
- `dexie` `^4.4.2` — IndexedDB wrapper; schema and singleton DB in `src/lib/db/client.ts` (database name `lesson-planner-db`)

**Infrastructure:**
- `fake-indexeddb` `^6.2.5` (dev) — polyfills IndexedDB in Vitest; loaded via `src/test/setup.ts`

**Note:** `@sveltejs/adapter-auto` is listed in `package.json` devDependencies but the active adapter in `svelte.config.js` is `@sveltejs/adapter-static` only. Prefer aligning declared deps with `svelte.config.js` when touching tooling.

## Configuration

**Environment:**
- No application use of `import.meta.env`, `$env/static/*`, or `process.env` detected under `src/`
- No `.env` files detected at repository root (nothing to load for local secrets in-tree)

**Build:**
- `svelte.config.js` — `vitePreprocess()`, static adapter, SPA fallback
- `vite.config.ts` — `sveltekit()` plugin; Vitest project `server` with `setupFiles: ['src/test/setup.ts']`
- `tsconfig.json` — extends `.svelte-kit/tsconfig.json`; strict TypeScript

## Platform Requirements

**Development:**
- Bun for install and scripts per `README.md` (`bun install`, `bun run dev`, `bun run test`, `bun run build`, `bun run check`)
- A modern browser with IndexedDB and localStorage

**Production:**
- Static file hosting: `bun run build` emits to `build/`; serve as static assets with `index.html` as SPA fallback (`README.md`)

---

*Stack analysis: 2026-04-20*
