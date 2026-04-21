# Codebase Structure

**Analysis Date:** 2026-04-21

## Directory Layout

```text
calendar-planner/
├── src/                      # Application source (routes, domain logic, persistence)
├── static/                   # Static assets served directly
├── docs/                     # Product specs and implementation plans
├── .planning/codebase/       # Generated codebase mapping documents
├── svelte.config.js          # SvelteKit adapter/runtime behavior
├── vite.config.ts            # Build + Vitest configuration
├── tsconfig.json             # TypeScript compiler settings
└── package.json              # Scripts and dependency manifest
```

## Directory Purposes

**`src/routes/`:**
- Purpose: Route-level UI, route loaders, and app shell.
- Contains: `+layout.svelte`, `+page.svelte`, nested dynamic route directories.
- Key files: `src/routes/+layout.svelte`, `src/routes/class/[classId]/+layout.ts`, `src/routes/class/[classId]/+page.svelte`.

**`src/lib/repos/`:**
- Purpose: Persistence-facing CRUD APIs and transactional business rules.
- Contains: One repo per bounded domain (`classes`, `lessons`, `students`, `attendance`).
- Key files: `src/lib/repos/classes.repo.ts`, `src/lib/repos/lessons.repo.ts`, `src/lib/repos/students.repo.ts`, `src/lib/repos/attendance.repo.ts`.

**`src/lib/db/`:**
- Purpose: Data schema/types and database utilities.
- Contains: Dexie client, row type definitions, retry utility, DB tests.
- Key files: `src/lib/db/client.ts`, `src/lib/db/types.ts`, `src/lib/db/withRetry.ts`.

**`src/lib/logic/`:**
- Purpose: Pure domain logic independent of UI and persistence.
- Contains: Contract/stat calculations and roster import parsing.
- Key files: `src/lib/logic/stats.ts`, `src/lib/logic/rosterImport.ts`.

**`src/lib/preferences/` and `src/lib/stores/`:**
- Purpose: Cross-route client state helpers.
- Contains: LocalStorage preference helpers and Svelte store(s).
- Key files: `src/lib/preferences/activeClass.ts`, `src/lib/stores/toast.ts`.

**`src/test/`:**
- Purpose: Shared test setup infrastructure.
- Contains: Environment setup for browser APIs in node tests.
- Key files: `src/test/setup.ts`.

## Key File Locations

**Entry Points:**
- `src/routes/+layout.svelte`: global app shell and class controls.
- `src/routes/+page.svelte`: root redirect/empty-state handling.
- `src/routes/class/[classId]/+page.svelte`: schedule + contract stats + session list.
- `src/routes/class/[classId]/students/+page.svelte`: roster CRUD/import UI.
- `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`: lesson details + attendance.

**Configuration:**
- `package.json`: runtime scripts (`dev`, `build`, `check`, `test`).
- `svelte.config.js`: static adapter with SPA fallback.
- `vite.config.ts`: SvelteKit plugin + Vitest project settings.
- `tsconfig.json`: strict TS settings and SvelteKit extension.

**Core Logic:**
- `src/lib/logic/stats.ts`: contract/business math and lesson/session counts.
- `src/lib/logic/rosterImport.ts`: import parsing strategy for TXT/CSV.
- `src/lib/repos/lessons.repo.ts`: lesson lifecycle and session-kind guardrails.

**Testing:**
- `src/lib/**/*.test.ts`: co-located unit/repo tests.
- `src/lib/db/client.smoke.test.ts`: Dexie smoke coverage.

## Naming Conventions

**Files:**
- SvelteKit route files use framework conventions (`+layout.svelte`, `+page.svelte`, `+layout.ts`, `+page.ts`).
- Repository modules use `<domain>.repo.ts` naming (`classes.repo.ts`, `lessons.repo.ts`).
- Logic modules are lower camel-like nouns in plain `.ts` files (`stats.ts`, `rosterImport.ts`).
- Tests mirror implementation names with `.test.ts` suffix (`stats.test.ts`, `lessons.repo.test.ts`).

**Directories:**
- Dynamic route segments use bracket notation (`src/routes/class/[classId]`, `src/routes/class/[classId]/lesson/[lessonId]`).
- Domain-oriented grouping under `src/lib/` (`db`, `repos`, `logic`, `stores`, `preferences`).

## Module Boundaries and Placement Rules

**UI and Route Orchestration (`src/routes/`):**
- Keep route files focused on state binding, user events, and navigation.
- Do not place direct Dexie table mutations here; call repository functions instead.

**Persistence and Business Rules (`src/lib/repos/` + `src/lib/db/`):**
- Put all table-level writes and transaction boundaries in repos.
- Keep schema/version migration details isolated in `src/lib/db/client.ts`.

**Pure Calculations and Parsing (`src/lib/logic/`):**
- Add deterministic helpers here when logic does not require IO.
- Reuse from routes via imports; keep these modules side-effect free for testing.

## Where to Add New Code

**New feature on class schedule:**
- Primary code: `src/routes/class/[classId]/+page.svelte`.
- Supporting logic: `src/lib/logic/stats.ts` (if pure math) or `src/lib/repos/lessons.repo.ts` (if persistence rule).
- Tests: `src/lib/logic/stats.test.ts` and/or `src/lib/repos/lessons.repo.test.ts`.

**New class-level subsection (tab):**
- Implementation: add nested route under `src/routes/class/[classId]/<feature>/+page.svelte`.
- Shared class context: consume from existing `src/routes/class/[classId]/+layout.ts` load.

**New data field on persisted entities:**
- Type updates: `src/lib/db/types.ts`.
- Migration/schema updates: `src/lib/db/client.ts`.
- Repo API updates: relevant files in `src/lib/repos/`.
- Route form bindings: corresponding `src/routes/**/+page.svelte`.

**Utilities and shared UI state:**
- Shared helper: `src/lib/logic/` (pure) or `src/lib/db/` (DB utility).
- Persisted preference: `src/lib/preferences/`.
- Cross-component ephemeral state: `src/lib/stores/`.

## Special Directories

**`.planning/codebase/`:**
- Purpose: Maintained architecture/stack/testing maps for planning workflows.
- Generated: Yes (by mapping agents/workflows).
- Committed: Yes.

**`.svelte-kit/`:**
- Purpose: SvelteKit generated build/type artifacts.
- Generated: Yes.
- Committed: No (derived outputs).

**`build/`:**
- Purpose: Static build output for deployment.
- Generated: Yes.
- Committed: No (distribution artifact).

## Architectural Impact Orientation (New Business Logic)

- Session kind (`class` vs `extra`) introduces a cross-module path: UI controls in `src/routes/class/[classId]/+page.svelte` and `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte` -> persistence validation in `src/lib/repos/lessons.repo.ts` -> schema support in `src/lib/db/types.ts` and `src/lib/db/client.ts`.
- Contract metrics (teacher/student-hour model) are intentionally centralized in `src/lib/logic/stats.ts`; new schedule metrics should extend this module first, then bind into route-level `$derived` values.
- Attendance behavior now depends on lesson kind; changes touching attendance must validate both `src/lib/repos/attendance.repo.ts` and lesson-kind transition logic in `src/lib/repos/lessons.repo.ts`.

---

*Structure analysis: 2026-04-21*
