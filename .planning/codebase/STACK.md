# Technology Stack

**Analysis Date:** 2026-04-21

## Languages

**Primary:**
- TypeScript - App logic, repositories, routes, and tests in `src/lib/**/*.ts` and `src/routes/**/*.ts`.
- Svelte (Svelte 5 syntax) - UI components and page composition in `src/routes/**/*.svelte`.

**Secondary:**
- JavaScript (ESM config) - Build and framework config in `svelte.config.js`.
- Markdown - Product/design and implementation plans in `README.md` and `docs/superpowers/**/*.md`.

## Runtime

**Environment:**
- Bun - Dependency install and script runner in `README.md` and `package.json` scripts.
- Browser runtime - Client-side app state and persistence (`localStorage`, `FileReader`, IndexedDB) in `src/lib/preferences/activeClass.ts`, `src/routes/class/[classId]/students/+page.svelte`, and `src/lib/db/client.ts`.

**Package Manager:**
- Bun (`bun install`, `bun run ...`) documented in `README.md` and `package.json`.
- Lockfile: present (`bun.lock`).

## Frameworks

**Core:**
- SvelteKit `^2.57.0` - Routing/layout/load boundaries in `src/routes/+layout.ts`, `src/routes/class/[classId]/+layout.ts`, and `src/routes/class/[classId]/lesson/[lessonId]/+page.ts`.
- Svelte `^5.55.2` - Component state/derived/effect model in `src/routes/+layout.svelte` and class/lesson pages.

**Testing:**
- Vitest `^4.1.3` - Unit tests and smoke tests in `src/lib/**/*.test.ts`, configured in `vite.config.ts`.
- fake-indexeddb `^6.2.5` - IndexedDB test environment shim in `src/test/setup.ts`.

**Build/Dev:**
- Vite `^8.0.7` - Dev server and build pipeline via `package.json` scripts and `vite.config.ts`.
- `@sveltejs/adapter-static` `^3.0.10` - Static SPA output with fallback `index.html` in `svelte.config.js`.
- `@sveltejs/vite-plugin-svelte` `^7.0.0` - Svelte plugin integration in `vite.config.ts`.

## Key Dependencies

**Critical:**
- `dexie` `^4.4.2` - Primary persistence abstraction over IndexedDB in `src/lib/db/client.ts`; all repositories use it (`src/lib/repos/*.repo.ts`).
- `@sveltejs/kit` `^2.57.0` - Core app/runtime API (`error`, load typing, navigation/environment imports) in route modules and layouts.

**Infrastructure:**
- `typescript` `^6.0.2` - Strict type-checking and module resolution in `tsconfig.json`.
- `svelte-check` `^4.4.6` - Static analysis via `check` scripts in `package.json`.

## Configuration

**Environment:**
- No required `.env` files detected in repository root.
- Application mode is client-only (`ssr = false`, `prerender = false`) in `src/routes/+layout.ts`.

**Build:**
- SvelteKit static adapter and SPA fallback configured in `svelte.config.js`.
- Vite + Vitest project setup in `vite.config.ts`.
- TypeScript strictness and bundler module resolution in `tsconfig.json`.

## Platform Requirements

**Development:**
- Bun installed locally (per `README.md` commands).
- Modern browser with IndexedDB and localStorage support (used in `src/lib/db/client.ts` and `src/lib/preferences/activeClass.ts`).

**Production:**
- Static file hosting target (`build/` output) with SPA fallback routing as documented in `README.md` and configured in `svelte.config.js`.

## Newly Added Business-Logic Stack Notes

- Contract-stat math for teacher/student hour conversions and class-vs-extra session semantics lives in `src/lib/logic/stats.ts`, with dedicated tests in `src/lib/logic/stats.test.ts`.
- Dexie schema v2 migration backfills new fields (`requiredStudentLessonHours`, `sessionKind`) in `src/lib/db/client.ts`, enabling newer planning behavior on existing local data.
- Repository-level rule enforcement for session-kind transitions (blocking `class -> extra` when absences exist) is implemented in `src/lib/repos/lessons.repo.ts` and validated in `src/lib/repos/lessons.repo.test.ts`.
- The `skipped` session kind is now first-class in the domain type (`src/lib/db/types.ts`), repository persistence (`src/lib/repos/lessons.repo.ts`), and UI workflows (`src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`).
- `skipped` behavior is normalized at the stack level: duration is forced to `0`, done-state editing is disabled, attendance is hidden, and existing absences are deleted on conversion in `src/lib/repos/lessons.repo.ts` and `src/lib/logic/sessionKindUi.ts`.

---

*Stack analysis: 2026-04-21*
