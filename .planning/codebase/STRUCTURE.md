# Codebase Structure

**Analysis Date:** 2026-05-15

## Directory Layout

```
calendar-planner/
├── src/                          # Application source (SvelteKit)
│   ├── app.html                  # HTML document template
│   ├── app.d.ts                  # App namespace types (minimal)
│   ├── lib/                      # Shared modules ($lib alias)
│   │   ├── assets/               # Static assets imported by components
│   │   ├── db/                   # Dexie client, types, withRetry
│   │   ├── kit/                  # SvelteKit helpers (load invalidation keys)
│   │   ├── logic/                # Pure domain functions + unit tests
│   │   ├── preferences/          # localStorage helpers
│   │   ├── repos/                # IndexedDB data access + repo tests
│   │   ├── stores/               # Svelte stores (toast)
│   │   └── index.ts              # Placeholder $lib barrel (unused exports)
│   ├── routes/                   # File-based routing (pages + loads)
│   │   ├── +layout.ts            # Root load, ssr/prerender flags
│   │   ├── +layout.svelte        # App chrome, class switcher, toasts
│   │   ├── +page.ts              # Home redirect / empty state
│   │   ├── +page.svelte
│   │   └── class/[classId]/      # Per-class area
│   │       ├── +layout.ts          # Load class row
│   │       ├── +layout.svelte      # Schedule / Students subnav
│   │       ├── +page.ts            # Load lessons list
│   │       ├── +page.svelte        # Schedule, stats, lesson table
│   │       ├── SemesterMap.svelte  # Semester mini-calendars (route-local)
│   │       ├── lesson/[lessonId]/  # Lesson detail + attendance
│   │       └── students/           # Roster CRUD + file import
│   └── test/
│       └── setup.ts              # Vitest: fake-indexeddb
├── static/                       # Copied as-is to build (robots.txt)
├── docs/                         # Design/plan markdown (not runtime)
├── build/                        # Production output (generated, gitignored)
├── package.json                  # Scripts, dependencies (Bun)
├── svelte.config.js              # adapter-static, SPA fallback
├── vite.config.ts                # SvelteKit plugin + Vitest projects
├── tsconfig.json                 # Strict TS, extends .svelte-kit
├── README.md                     # Dev/test/build instructions
├── AGENTS.md / CLAUDE.md         # Agent/GitNexus rules (not app code)
└── .planning/                    # GSD planning artifacts
```

## Directory Purposes

**`src/routes/`:**
- Purpose: URL structure, page UI, and route `load` functions.
- Contains: SvelteKit conventions (`+page.svelte`, `+page.ts`, `+layout.svelte`, `+layout.ts`), dynamic `[classId]` and `[lessonId]` segments.
- Key files: `src/routes/+layout.ts`, `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/SemesterMap.svelte`.

**`src/lib/db/`:**
- Purpose: Database schema and low-level persistence helpers.
- Contains: `client.ts`, `types.ts`, `withRetry.ts`, smoke/retry tests.
- Key files: `src/lib/db/client.ts`, `src/lib/db/types.ts`.

**`src/lib/repos/`:**
- Purpose: All IndexedDB reads/writes used by the app.
- Contains: One file per aggregate (`classes`, `lessons`, `students`, `attendance`) and `*.repo.test.ts` integration-style tests.
- Key files: `src/lib/repos/classes.repo.ts`, `src/lib/repos/lessons.repo.ts`.

**`src/lib/logic/`:**
- Purpose: Pure functions — safe to import from repos, loaders, and UI without side effects.
- Contains: Stats, calendar, import parsers, session-kind UI rules; tests co-located as `*.test.ts`.
- Key files: `src/lib/logic/stats.ts`, `src/lib/logic/semesterCalendar.ts`.

**`src/lib/kit/`:**
- Purpose: SvelteKit-specific shared constants (invalidation keys).
- Contains: `loadKeys.ts` only.

**`src/lib/preferences/` & `src/lib/stores/`:**
- Purpose: Browser persistence and global UI feedback outside `load` data.
- Key files: `src/lib/preferences/activeClass.ts`, `src/lib/stores/toast.ts`.

**`src/test/`:**
- Purpose: Vitest global setup (not a test suite directory for specs).
- Key files: `src/test/setup.ts` registers `fake-indexeddb`.

**`static/`:**
- Purpose: Files served without bundling transformation.
- Contains: `robots.txt`.

**`docs/`:**
- Purpose: Human design notes and superpowers plans; reference only for implementers.

## Key File Locations

**Entry Points:**
- `src/app.html`: Document shell.
- `src/routes/+layout.ts`: Global `load`, disables SSR/prerender.
- `src/routes/+page.ts`: `/` → class redirect or empty state.
- `src/lib/db/client.ts`: Dexie DB singleton instantiated on import.

**Configuration:**
- `package.json`: `dev`, `build`, `test`, `check` scripts; runtime dep `dexie` only.
- `svelte.config.js`: `@sveltejs/adapter-static` with `fallback: 'index.html'`.
- `vite.config.ts`: SvelteKit plugin; Vitest `server` project, `src/test/setup.ts`.
- `tsconfig.json`: Strict TypeScript; path alias `$lib` → `src/lib` (Kit default).

**Core Logic:**
- `src/lib/logic/stats.ts`: Contract hour calculations for schedule UI.
- `src/lib/logic/semesterCalendar.ts`: Month grids, semester range, date helpers.
- `src/lib/logic/rosterImport.ts`: `.txt` / `.csv` name list parsing.
- `src/lib/logic/sessionKindUi.ts`: Labels and editability by session kind.

**Data Layer:**
- `src/lib/repos/*.repo.ts`: CRUD per entity.
- `src/lib/db/types.ts`: Shared row types and ID aliases.

**UI Surfaces:**
- `src/routes/+layout.svelte`: Header, class CRUD, toast display.
- `src/routes/class/[classId]/+page.svelte`: Main schedule + stats + add session.
- `src/routes/class/[classId]/SemesterMap.svelte`: Semester date range + calendars.
- `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`: Lesson editor + absences.
- `src/routes/class/[classId]/students/+page.svelte`: Roster management + import.

**Testing:**
- Co-located: `src/lib/**/*.test.ts` next to implementation.
- Setup: `src/test/setup.ts`.
- Config: `vite.config.ts` `test.projects[0]`.

## Naming Conventions

**Files:**
- SvelteKit routes: `+page.svelte`, `+page.ts`, `+layout.svelte`, `+layout.ts` in folder matching URL segment.
- Repositories: `{entity}.repo.ts` (e.g. `lessons.repo.ts`).
- Pure logic: `{topic}.ts` with `{topic}.test.ts`.
- Route-local components: PascalCase `.svelte` beside routes (e.g. `SemesterMap.svelte`).
- Types/DB: `types.ts`, `client.ts` under `src/lib/db/`.

**Directories:**
- Dynamic route params: bracket folders `[classId]`, `[lessonId]`.
- `src/lib/{layer}/` grouped by responsibility (`db`, `repos`, `logic`, `kit`, `stores`, `preferences`).

**Functions:**
- Repos: verb-first async — `listLessons`, `createClass`, `deleteLessonCascade`, `setAbsent`.
- Logic: descriptive pure names — `remainingFlexTeacherHours`, `monthGridMondayFirst`.
- Load keys: `classLoadKey`, `lessonLoadKey`, constant `CLASSES_LIST_LOAD_KEY`.

**Types:**
- Row suffix for DB entities: `ClassRow`, `LessonRow`.
- ID aliases in `src/lib/db/types.ts`: `ClassId`, `LessonId`, `StudentId`.
- Union literals for enums: `LessonSessionKind`.

## Where to Add New Code

**New route / screen:**
- Add folder under `src/routes/` following URL shape.
- Add `+page.ts` `load` if the page needs data; call `depends()` with a key from `src/lib/kit/loadKeys.ts` (add a new key function there if needed).
- Add `+page.svelte` for UI; mutate via repos + `invalidate()`.

**New persisted entity or field:**
- Extend types in `src/lib/db/types.ts`.
- Bump Dexie version in `src/lib/db/client.ts` with `.stores()` and `.upgrade()` as needed.
- Add or extend `src/lib/repos/{entity}.repo.ts`; keep transactions and cascades in the repo, not in `.svelte` files.

**New business rule (no I/O):**
- Add or extend a module in `src/lib/logic/` and unit test alongside as `*.test.ts`.
- Import from repos only when the rule must run at write time (see `classes.repo.ts` + `semesterCalendar`).

**New cross-route UI behavior:**
- Global chrome: `src/routes/+layout.svelte`.
- Class-scoped nav: `src/routes/class/[classId]/+layout.svelte`.
- Toasts: `showToast` from `src/lib/stores/toast.ts`.

**New route-local widget:**
- Prefer colocated `ComponentName.svelte` next to the route that owns it (pattern: `SemesterMap.svelte`).
- Move to `src/lib/components/` only if reused by multiple routes (folder does not exist yet — create when needed).

**New tests:**
- Unit: `src/lib/logic/{name}.test.ts` or `src/lib/db/{name}.test.ts`.
- Repo/DB integration: `src/lib/repos/{name}.repo.test.ts` with `fake-indexeddb` from `src/test/setup.ts`.

## Special Directories

**`.svelte-kit/`:**
- Purpose: Generated SvelteKit types and build intermediates.
- Generated: Yes.
- Committed: No (gitignored).

**`build/`:**
- Purpose: Static production assets after `bun run build`.
- Generated: Yes.
- Committed: No.

**`node_modules/`:**
- Purpose: Installed dependencies.
- Generated: Yes.
- Committed: No.

**`.planning/`:**
- Purpose: GSD roadmap, codebase maps, phase artifacts.
- Generated: Partially by tooling.
- Committed: Per project policy (codebase docs live under `.planning/codebase/`).

**`.cursor/`, `.claude/`:**
- Purpose: Editor/agent skills and GSD workflow — not imported by the app.
- Committed: Yes in this repo; ignore for runtime structure.

**`docs/`:**
- Purpose: External design/spec markdown.
- Committed: Yes; not bundled into the SPA unless imported (currently not).

---

*Structure analysis: 2026-05-15*
