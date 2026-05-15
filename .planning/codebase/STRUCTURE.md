# Codebase Structure

**Analysis Date:** 2026-05-15

## Directory Layout

```
calendar-planner/
├── src/                    # Application source (SvelteKit)
│   ├── routes/             # File-based routes, loads, page UI
│   ├── lib/                # Shared modules ($lib alias)
│   └── test/               # Vitest global setup
├── static/                 # Static assets copied to build root
├── docs/                   # Design specs and plans (not runtime)
├── .planning/              # GSD planning artifacts
├── .cursor/                # Cursor agents, GSD skills/workflows
├── .claude/                # Claude skills (e.g. GitNexus)
├── .agents/                # Agent skill stubs
├── .gitnexus/              # GitNexus index metadata
├── .vscode/                # Editor settings
├── svelte.config.js        # SvelteKit + static adapter
├── vite.config.ts          # Vite + Vitest
├── tsconfig.json           # Strict TS, extends .svelte-kit
├── package.json            # Scripts (bun), deps (SvelteKit, Dexie)
└── README.md               # Dev/test/build instructions
```

## Directory Purposes

**`src/routes/`:**
- Purpose: SvelteKit routing, `load` functions, and page-level UI.
- Contains: `+layout.ts` / `+layout.svelte`, `+page.ts` / `+page.svelte`, dynamic `[classId]` and `[lessonId]` segments.
- Key files: `src/routes/+layout.ts`, `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/SemesterMap.svelte`

**`src/lib/db/`:**
- Purpose: IndexedDB schema and infrastructure.
- Contains: Dexie client, row types, `withRetry`.
- Key files: `src/lib/db/client.ts`, `src/lib/db/types.ts`, `src/lib/db/withRetry.ts`

**`src/lib/repos/`:**
- Purpose: Persistence API per aggregate (class, lesson, student, attendance).
- Contains: `*.repo.ts` and co-located `*.repo.test.ts`.
- Key files: `src/lib/repos/classes.repo.ts`, `lessons.repo.ts`, `students.repo.ts`, `attendance.repo.ts`

**`src/lib/logic/`:**
- Purpose: Pure domain helpers (stats, calendar, import, session policy).
- Contains: `*.ts` modules and `*.test.ts` beside them.
- Key files: `src/lib/logic/stats.ts`, `semesterCalendar.ts`, `sessionKindPolicy.ts`, `rosterImport.ts`

**`src/lib/kit/`:**
- Purpose: SvelteKit-specific mutation and cache-key utilities.
- Contains: `loadKeys.ts`, `runMutation.ts`, `repoErrors.ts`, tests.
- Key files: `src/lib/kit/runMutation.ts`, `src/lib/kit/loadKeys.ts`

**`src/lib/preferences/`:**
- Purpose: Browser `localStorage` helpers for UX (last class).
- Key files: `src/lib/preferences/activeClass.ts`

**`src/lib/stores/`:**
- Purpose: Shared Svelte stores (toast).
- Key files: `src/lib/stores/toast.ts`

**`src/lib/assets/`:**
- Purpose: Imported static assets (favicon SVG).
- Key files: `src/lib/assets/favicon.svg`

**`src/test/`:**
- Purpose: Vitest setup (`fake-indexeddb/auto`).
- Key files: `src/test/setup.ts`

**`static/`:**
- Purpose: Files served as-is (`robots.txt`).
- Generated: No
- Committed: Yes

**`docs/`:**
- Purpose: Human design docs (`docs/superpowers/specs/`, `docs/superpowers/plans/`).
- Not imported by app code.

**`.planning/codebase/`:**
- Purpose: Codebase intelligence for GSD (`ARCHITECTURE.md`, `STRUCTURE.md`, etc.).
- Committed: Yes (project choice)

**Tooling dirs (`.cursor/`, `.claude/`, `.agents/`, `.gitnexus/`):**
- Purpose: AI workflow skills, agents, code intelligence index — outside app runtime.

## Key File Locations

**Entry Points:**
- `src/app.html`: HTML shell for SvelteKit
- `src/routes/+layout.ts`: Root load (`classes`), `ssr = false`, `prerender = false`
- `src/routes/+page.ts`: `/` redirect to active class
- `svelte.config.js`: Static adapter, SPA fallback

**Configuration:**
- `package.json`: `dev`, `build`, `test`, `check` scripts; `dexie` dependency
- `vite.config.ts`: SvelteKit plugin, Vitest `node` project, `src/test/setup.ts`
- `tsconfig.json`: Strict TypeScript
- `svelte.config.js`: `@sveltejs/adapter-static`

**Core Logic:**
- `src/lib/db/client.ts`: Dexie DB + migrations
- `src/lib/repos/*.repo.ts`: All persistence
- `src/lib/logic/stats.ts`: Hour/contract calculations
- `src/lib/logic/sessionKindPolicy.ts`: Lesson kind rules
- `src/lib/kit/runMutation.ts`: Write + invalidate + toast

**Testing:**
- `src/**/*.test.ts`: Co-located unit tests (logic, repos, kit, db)
- `src/test/setup.ts`: IndexedDB polyfill for Vitest
- `vite.config.ts`: `include: ['src/**/*.{test,spec}.{js,ts}']`

## Naming Conventions

**Files:**
- SvelteKit routes: `+page.svelte`, `+page.ts`, `+layout.svelte`, `+layout.ts` under `src/routes/`
- Repositories: `{entity}.repo.ts` (e.g. `lessons.repo.ts`)
- Domain modules: `{concern}.ts` in `src/lib/logic/` (e.g. `semesterCalendar.ts`)
- Tests: same basename + `.test.ts` next to source
- Colocated UI: `SemesterMap.svelte` beside class `+page.svelte` (not under `lib/components/`)

**Directories:**
- Dynamic route params: `[classId]`, `[lessonId]` (bracket folders in `src/routes/`)
- Lib subfolders by role: `db`, `repos`, `logic`, `kit`, `preferences`, `stores`, `assets`

**Types & IDs:**
- Branded string aliases: `ClassId`, `StudentId`, `LessonId` in `src/lib/db/types.ts`
- Row types suffixed `Row`: `ClassRow`, `LessonRow`, etc.
- Session kind union: `LessonSessionKind = 'class' | 'extra' | 'skipped'`

**Functions:**
- Repos: verb-first `listClasses`, `getLesson`, `createLesson`, `updateClass`, `deleteClassCascade`, `setAbsent`
- Logic: descriptive pure names `sumScheduledTeacherHours`, `monthGridMondayFirst`, `parseCsvNames`
- Kit: `runMutation`, `classLessonsLoadKey`, `repoError`, `repoErrorMessage`

## Where to Add New Code

**New route / screen:**
- Add under `src/routes/` following existing nesting (e.g. new tab under `src/routes/class/[classId]/`)
- Pair `+page.ts` (`load` + `depends(key)`) with `+page.svelte`
- Reuse `runMutation` for writes; add a new `*LoadKey` in `src/lib/kit/loadKeys.ts` if the screen needs its own invalidation slice

**New persisted entity:**
- Types: `src/lib/db/types.ts`
- Schema/index: new table + Dexie version bump in `src/lib/db/client.ts`
- Repo: `src/lib/repos/{entity}.repo.ts` (+ `.test.ts`)
- Load keys: extend `src/lib/kit/loadKeys.ts` if loads should be slice-invalidated

**New business rule (no I/O):**
- `src/lib/logic/{topic}.ts` + `{topic}.test.ts`
- Call from repos for write-time enforcement; from routes for display-only rules

**New write from UI:**
- Repo function → `runMutation({ fn, invalidate: appropriate keys })` in the relevant `+page.svelte` or layout
- Add `RepoErrorCode` + message in `src/lib/kit/repoErrors.ts` if users need specific copy

**New shared UI component (reused across routes):**
- Prefer `src/lib/components/` (directory does not exist yet — create when needed) or colocate under the route if single-use (matches `SemesterMap.svelte` pattern)

**Utilities / one-off helpers:**
- Domain: `src/lib/logic/`
- SvelteKit/navigation: `src/lib/kit/`
- Do not put Dexie calls in routes or logic — keep them in repos

## Special Directories

**`.svelte-kit/`:**
- Purpose: Generated types, client/server manifests
- Generated: Yes (by `svelte-kit sync`)
- Committed: No (typically gitignored)

**`build/`:**
- Purpose: Static production output after `bun run build`
- Generated: Yes
- Committed: No

**`node_modules/`:**
- Purpose: Dependencies
- Generated: Yes (`bun install`)
- Committed: No

## Route Map (application URLs)

| URL | Load data | Primary UI file |
|-----|-----------|-----------------|
| `/` | Redirect only | — |
| `/class/{classId}` | `class`, `lessons` | `src/routes/class/[classId]/+page.svelte` |
| `/class/{classId}/students` | `class`, `students` | `src/routes/class/[classId]/students/+page.svelte` |
| `/class/{classId}/lesson/{lessonId}` | `lesson`, `students`, `absentIds` | `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte` |

Global class list and chrome: `src/routes/+layout.svelte` (data from `+layout.ts`).

Class sub-navigation and last-class persistence: `src/routes/class/[classId]/+layout.svelte` + `+layout.ts`.

## Import Aliases

- `$lib/*` → `src/lib/*` (SvelteKit default)
- `$app/navigation`, `$app/paths`, `$app/state` — SvelteKit runtime modules
- Use `$lib/...` for all shared app code; avoid deep relative imports from routes when possible

---

*Structure analysis: 2026-05-15*
