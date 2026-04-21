# Codebase Structure

**Analysis Date:** 2026-04-21

## Directory Layout

```text
calendar-planner/
├── src/                      # Runtime app code (routes, repos, db, logic, stores)
├── static/                   # Static files served as-is
├── docs/superpowers/         # Product specs and implementation plans
├── .planning/codebase/       # Architecture/stack/testing mapping docs
├── .cursor/skills/           # Project workflow skills for GSD commands
├── svelte.config.js          # SvelteKit adapter and preprocessing config
├── vite.config.ts            # Vite + Vitest configuration
├── tsconfig.json             # TypeScript compiler settings
└── package.json              # Scripts and dependency manifest
```

## Directory Purposes

**`src/routes/`:**
- Purpose: SvelteKit route tree and route-local orchestration.
- Contains: App shell routes, class workspace routes, and loader files.
- Key files: `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/routes/class/[classId]/+layout.ts`, `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`.

**`src/lib/repos/`:**
- Purpose: Data-access APIs and write invariants.
- Contains: Domain repositories for class, lesson, student, and attendance entities.
- Key files: `src/lib/repos/classes.repo.ts`, `src/lib/repos/lessons.repo.ts`, `src/lib/repos/students.repo.ts`, `src/lib/repos/attendance.repo.ts`, `src/lib/repos/lessons.repo.test.ts`.

**`src/lib/db/`:**
- Purpose: Persistent model contracts, Dexie schema, and DB utilities.
- Contains: Table type definitions, schema versioning/migrations, retry helper, smoke test.
- Key files: `src/lib/db/client.ts`, `src/lib/db/types.ts`, `src/lib/db/withRetry.ts`.

**`src/lib/logic/`:**
- Purpose: Pure domain logic independent of UI and persistence.
- Contains: Contract/stat calculations, session-kind UI behavior helpers, import parsing.
- Key files: `src/lib/logic/stats.ts`, `src/lib/logic/sessionKindUi.ts`, `src/lib/logic/rosterImport.ts`.

**`src/lib/preferences/` and `src/lib/stores/`:**
- Purpose: Cross-route client state helpers.
- Contains: LocalStorage preference helpers and Svelte store(s).
- Key files: `src/lib/preferences/activeClass.ts`, `src/lib/stores/toast.ts`.

**`src/test/`:**
- Purpose: Shared test setup infrastructure.
- Contains: Environment setup for browser APIs in node tests.
- Key files: `src/test/setup.ts`.

**`docs/superpowers/specs/` and `docs/superpowers/plans/`:**
- Purpose: Product-level decisions and implementation plans that drive code changes.
- Contains: Dated specification and plan markdown files.
- Key files: `docs/superpowers/specs/2026-04-21-skipped-lesson-kind-design.md`, `docs/superpowers/plans/2026-04-21-skipped-lesson-kind.md`.

## Key File Locations

**Entry Points:**
- `src/routes/+layout.svelte`: global app shell and class controls.
- `src/routes/+page.svelte`: root redirect/empty-state handling.
- `src/routes/class/[classId]/+page.svelte`: schedule + contract stats + session list.
- `src/routes/class/[classId]/students/+page.svelte`: roster CRUD/import UI.
- `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`: lesson details + attendance.
- `src/routes/class/[classId]/+layout.ts`: class existence guard and class payload loader.
- `src/routes/class/[classId]/lesson/[lessonId]/+page.ts`: lesson ownership guard.

**Configuration:**
- `package.json`: runtime scripts (`dev`, `build`, `check`, `test`).
- `svelte.config.js`: static adapter with SPA fallback.
- `vite.config.ts`: SvelteKit plugin + Vitest project settings.
- `tsconfig.json`: strict TS settings and SvelteKit extension.

**Core Logic:**
- `src/lib/logic/stats.ts`: contract/business math and lesson/session counts.
- `src/lib/logic/sessionKindUi.ts`: kind-specific UI rules (`class`/`extra`/`skipped`).
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
- Session-kind helper module follows domain noun naming (`sessionKindUi.ts`).
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
- Keep session-kind persistence invariants (including `skipped` coercion and absence cleanup) in `src/lib/repos/lessons.repo.ts`.

**Pure Calculations and Parsing (`src/lib/logic/`):**
- Add deterministic helpers here when logic does not require IO.
- Reuse from routes via imports; keep these modules side-effect free for testing.
- Use `src/lib/logic/sessionKindUi.ts` for any new kind-specific UI rules instead of embedding conditionals in multiple route files.

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

**New session kind behavior (e.g., extension of `skipped` rules):**
- UI behavior helpers: `src/lib/logic/sessionKindUi.ts`.
- Persistence invariants and transitions: `src/lib/repos/lessons.repo.ts`.
- Schedule and detail bindings: `src/routes/class/[classId]/+page.svelte` and `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`.
- Regression tests: `src/lib/logic/sessionKindUi.test.ts`, `src/lib/repos/lessons.repo.test.ts`, `src/lib/logic/stats.test.ts`.

**Utilities and shared UI state:**
- Shared helper: `src/lib/logic/` (pure) or `src/lib/db/` (DB utility).
- Persisted preference: `src/lib/preferences/`.
- Cross-component ephemeral state: `src/lib/stores/`.

## Special Directories

**`.planning/codebase/`:**
- Purpose: Maintained architecture/stack/testing maps for planning workflows.
- Generated: Yes (by mapping agents/workflows).
- Committed: Yes.

**`.cursor/skills/`:**
- Purpose: Project-local GSD skill definitions and workflow adapters.
- Generated: No.
- Committed: Yes.

**`.svelte-kit/`:**
- Purpose: SvelteKit generated build/type artifacts.
- Generated: Yes.
- Committed: No (derived outputs).

**`build/`:**
- Purpose: Static build output for deployment.
- Generated: Yes.
- Committed: No (distribution artifact).

## Architectural Impact Orientation (Skipped Addition)

- Session kind now has three supported values (`class`, `extra`, `skipped`) in `src/lib/db/types.ts`, and both schedule/detail routes expose the `skipped` path in selects (`src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`).
- Skipped semantics are split by responsibility: route-level behavior flags in `src/lib/logic/sessionKindUi.ts`, hard persistence invariants in `src/lib/repos/lessons.repo.ts`.
- Transitioning a lesson to `skipped` crosses modules and tables: UI intent in route file -> `updateLesson` transaction in repo -> absence deletion in `absences` table via `src/lib/db/client.ts`.
- Contract metrics (teacher/student-hour model) are intentionally centralized in `src/lib/logic/stats.ts`; new schedule metrics should extend this module first, then bind into route-level `$derived` values.
- Attendance visibility now depends on session kind helper rules (`attendanceVisibleForKind`) and repository transition behavior; attendance-related changes must be validated in both `src/lib/repos/attendance.repo.ts` and `src/lib/repos/lessons.repo.ts`.

---

*Structure analysis: 2026-04-21*
