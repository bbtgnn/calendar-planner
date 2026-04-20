# Codebase Structure

**Analysis Date:** 2026-04-20

## Directory Layout

```
calendar-planner/
├── docs/                    # Project documentation (non-runtime)
├── src/
│   ├── app.d.ts             # SvelteKit / global App types
│   ├── app.html             # HTML template for SvelteKit
│   ├── lib/                 # Shared code (`$lib` alias)
│   │   ├── assets/          # Static assets imported from TS/Svelte
│   │   ├── db/              # Dexie client, types, retry helper
│   │   ├── logic/           # Pure functions (stats, import parsing)
│   │   ├── preferences/     # Browser persistence helpers
│   │   ├── repos/           # IndexedDB access per aggregate
│   │   ├── stores/          # Svelte stores (toast)
│   │   └── index.ts         # `$lib` barrel (placeholder comment)
│   ├── routes/              # SvelteKit file-based routes
│   │   ├── +layout.ts       # SPA: ssr/prerender flags
│   │   ├── +layout.svelte   # App shell
│   │   ├── +page.svelte     # Home / redirect
│   │   └── class/
│   │       └── [classId]/
│   │           ├── +layout.ts
│   │           ├── +layout.svelte
│   │           ├── +page.svelte          # Schedule
│   │           ├── students/
│   │           │   └── +page.svelte
│   │           └── lesson/
│   │               └── [lessonId]/
│   │                   ├── +page.ts
│   │                   └── +page.svelte
│   └── test/
│       └── setup.ts         # Vitest setup (e.g. fake IndexedDB)
├── package.json
├── svelte.config.js
├── tsconfig.json
└── vite.config.ts
```

## Directory Purposes

**`src/routes/`:**
- Purpose: All user-facing pages and layouts; defines URLs and which data loads at navigation.
- Contains: `+page.svelte`, `+layout.svelte`, `+layout.ts`, `+page.ts` per SvelteKit conventions.
- Key files: `src/routes/+layout.ts`, `src/routes/+layout.svelte`, `src/routes/class/[classId]/+layout.ts`, `src/routes/class/[classId]/lesson/[lessonId]/+page.ts`

**`src/lib/db/`:**
- Purpose: Database schema singleton and shared row types; small I/O resilience helper.
- Contains: Dexie subclass, TypeScript row models, `withRetry`.
- Key files: `src/lib/db/client.ts`, `src/lib/db/types.ts`, `src/lib/db/withRetry.ts`

**`src/lib/repos/`:**
- Purpose: All read/write paths to IndexedDB for classes, students, lessons, attendance.
- Contains: `*.repo.ts` modules and co-located `*.repo.test.ts` where present.
- Key files: `src/lib/repos/classes.repo.ts`, `src/lib/repos/students.repo.ts`, `src/lib/repos/lessons.repo.ts`, `src/lib/repos/attendance.repo.ts`

**`src/lib/logic/`:**
- Purpose: Pure, framework-agnostic helpers for UI features.
- Contains: Statistics and roster parsing; co-located `*.test.ts`.
- Key files: `src/lib/logic/stats.ts`, `src/lib/logic/rosterImport.ts`

**`src/lib/stores/` and `src/lib/preferences/`:**
- Purpose: Cross-route UI state (`toast`) and small `localStorage` keys (`activeClass`).
- Key files: `src/lib/stores/toast.ts`, `src/lib/preferences/activeClass.ts`

**`src/lib/assets/`:**
- Purpose: Files imported as modules (favicon).
- Key files: `src/lib/assets/favicon.svg`

**`src/test/`:**
- Purpose: Vitest setup shared by unit tests.
- Key files: `src/test/setup.ts`

**`docs/`:**
- Purpose: Design and planning markdown outside the app bundle.

## Key File Locations

**Entry Points:**
- `vite.config.ts`: Vite + SvelteKit plugin and Vitest project definition.
- `svelte.config.js`: Adapter-static and preprocess configuration.
- `src/app.html`: Document shell for the SPA.
- `src/routes/+layout.ts`: Global `ssr` / `prerender` flags for client-only app.

**Configuration:**
- `package.json`: Scripts (`dev`, `build`, `test`, `check`) and dependencies (`@sveltejs/kit`, `svelte`, `dexie`, `vitest`, etc.).
- `tsconfig.json`: Strict TypeScript extending `.svelte-kit/tsconfig.json`; `$lib` resolved by SvelteKit.

**Core Logic:**
- `src/lib/db/client.ts`: IndexedDB schema and `db` export.
- `src/lib/repos/*.repo.ts`: Data mutations and queries used by routes.
- `src/lib/logic/*.ts`: Pure functions consumed by pages.

**Testing:**
- `vite.config.ts`: `test.projects` with `environment: 'node'` and `src/test/setup.ts`.
- Tests live next to implementation: `src/lib/**/*.test.ts`.

## Naming Conventions

**Files:**
- Routes: `+page.svelte`, `+layout.svelte`, `+layout.ts`, `+page.ts` (SvelteKit mandatory names).
- Data access: `*.repo.ts` (example: `classes.repo.ts`).
- Tests: `*.test.ts` co-located with the module under test (example: `classes.repo.test.ts`).
- Types and DB: `types.ts`, `client.ts` under `db/`.

**Directories:**
- Dynamic segments: bracket folders `[classId]`, `[lessonId]` under `src/routes/`.
- Feature buckets: `repos`, `logic`, `stores`, `preferences` under `src/lib/`.

**Symbols (prescriptive for new code):**
- Repository exports: use verb-led function names (`listClasses`, `createLesson`, `deleteClassCascade`).
- Row types: suffix `Row` (`ClassRow` in `src/lib/db/types.ts`).
- Cascade deletes: suffix `Cascade` on repo functions that delete dependent rows.

## Where to Add New Code

**New Feature:**
- Primary UI: add or extend routes under `src/routes/`; prefer a new folder segment or `+page.svelte` sibling.
- If the feature needs persistence: add or extend tables in `src/lib/db/client.ts` and types in `src/lib/db/types.ts`, then add functions in a new or existing `src/lib/repos/*.repo.ts`.

**New Component or Module:**
- Shared non-route code: place under `src/lib/` in the appropriate subfolder (`logic` for pure functions, `repos` for storage, `stores` for global client state).

**Utilities:**
- Shared helpers with no I/O: `src/lib/logic/` or a new `src/lib/utils/` only if multiple domains need it and `logic` is misleading.

**Tests:**
- Add `src/lib/<area>/<name>.test.ts` beside the implementation; ensure `vite.config.ts` patterns still include the file.

## Special Directories

**`.svelte-kit/`:**
- Purpose: Generated SvelteKit output and generated `tsconfig` fragments.
- Generated: Yes.
- Committed: Typically no (follow project `.gitignore`).

**`docs/`:**
- Purpose: Human-written specifications and design notes.
- Generated: No.
- Committed: Yes.

---

*Structure analysis: 2026-04-20*
