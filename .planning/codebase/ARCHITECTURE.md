# Architecture

**Analysis Date:** 2026-05-15

## Pattern Overview

**Overall:** Client-only SvelteKit SPA with layered separation — UI routes, SvelteKit load/cache orchestration, repository persistence, and pure domain logic.

**Key Characteristics:**
- All data lives in the browser via Dexie (IndexedDB); no server API or SSR data fetching.
- Reads flow through SvelteKit `load` functions that call repos; writes flow through `runMutation` → repos → optional `invalidate()` of scoped load keys.
- Business rules for lessons, semesters, contract hours, and session kinds live in `src/lib/logic/` as testable pure functions; repos enforce write-time policy at persistence boundaries.

## Layers

**Presentation (routes & local UI components):**
- Purpose: Pages, forms, navigation, and derived UI state for teachers managing classes.
- Location: `src/routes/`, colocated `SemesterMap.svelte`
- Contains: Svelte 5 components (`$props`, `$state`, `$derived`, `$effect`), inline styles, event handlers calling `runMutation`.
- Depends on: `$lib/kit/*`, `$lib/repos/*`, `$lib/logic/*`, `$lib/stores/toast`, `$lib/preferences/activeClass`
- Used by: Browser navigation only (static build)

**Application orchestration (SvelteKit kit helpers):**
- Purpose: Coordinate load invalidation, mutation retries, and user-facing error messages after writes.
- Location: `src/lib/kit/`
- Contains: `loadKeys.ts` (custom `depends`/`invalidate` keys), `runMutation.ts`, `repoErrors.ts`
- Depends on: `$app/navigation`, `$lib/db/withRetry`, `$lib/stores/toast`
- Used by: Route layouts/pages and `SemesterMap.svelte`

**Domain logic (pure):**
- Purpose: Calendar grids, semester validation, contract/student hour math, session-kind UI/write rules, roster parsing.
- Location: `src/lib/logic/`
- Contains: Stateless functions and types; no Dexie or Svelte imports (except `sessionKindPolicy` → `repoErrors` for thrown codes).
- Depends on: `$lib/db/types` for row shapes
- Used by: Repos (write policy), route components (display/stats), tests

**Data access (repositories):**
- Purpose: CRUD and transactional cascades over IndexedDB tables.
- Location: `src/lib/repos/`
- Contains: `classes.repo.ts`, `lessons.repo.ts`, `students.repo.ts`, `attendance.repo.ts`
- Depends on: `$lib/db/client`, `$lib/logic/*` (validation/policy), `$lib/kit/repoErrors`
- Used by: `load` functions and UI mutations

**Persistence:**
- Purpose: Dexie schema, migrations, typed rows, IndexedDB retry helper.
- Location: `src/lib/db/`
- Contains: `client.ts` (`LessonPlannerDB`), `types.ts`, `withRetry.ts`
- Depends on: `dexie` only
- Used by: All repos; tests use `fake-indexeddb` via `src/test/setup.ts`

**Cross-cutting preferences & feedback:**
- Purpose: Remember last-opened class; surface mutation errors/success.
- Location: `src/lib/preferences/activeClass.ts`, `src/lib/stores/toast.ts`
- Depends on: `localStorage` (guarded for SSR), Svelte `writable`
- Used by: Root/class layouts and `runMutation`

## Data Flow

**Initial app load:**

1. `src/routes/+layout.ts` runs with `ssr = false`; `depends(CLASSES_LIST_LOAD_KEY)` and `listClasses()` populate root layout data.
2. `src/routes/+page.ts` reads `getLastClassId()` from `localStorage` and `redirect(303, '/class/{id}')` to the remembered or first class.
3. `src/routes/class/[classId]/+layout.ts` loads class metadata via `getClass()` or `error(404)`.
4. Nested `+page.ts` files load lessons, students, or lesson detail + absences per route.

**Read path (display):**

1. Page/layout `load` calls repo `list*` / `get*` functions against Dexie.
2. Svelte components receive `data` from `PageData` / layout data types.
3. Derived stats and calendar cells computed in components via `$lib/logic/stats` and `$lib/logic/semesterCalendar` (not stored separately).

**Write path (mutation):**

1. UI handler calls `runMutation({ fn, invalidate, successToast?, mapError? })`.
2. `fn` typically wraps a repo method; `withRetry` runs once by default on transient IndexedDB errors.
3. On success, `invalidate()` runs for one or more `CustomLoadKey` values from `loadKeys.ts`, rerunning only dependent loads (slice invalidation).
4. Toast shown on success or mapped failure; handler may use `onSuccess` for navigation or local form reset.

**Class-scoped load slices (invalidation granularity):**

| Key helper | Scope | Typical invalidation trigger |
|------------|--------|------------------------------|
| `CLASSES_LIST_LOAD_KEY` | All classes | Create/rename/delete class |
| `classMetaLoadKey(classId)` | Class row (targets, semester) | Update class, semester map |
| `classLessonsLoadKey(classId)` | Lesson list | Create/update/delete lesson |
| `classStudentsLoadKey(classId)` | Student roster | Student CRUD, import |
| `lessonLoadKey(lessonId)` | Single lesson + absences | Lesson edit, attendance toggle |
| `classScopeLoadKeys(classId)` | All three class slices | Class delete cascade |

**State Management:**
- **Server-shaped client data:** SvelteKit `load` return values (`classes`, `class`, `lessons`, `students`, `lesson`, `absentIds`) — refetched via `invalidate`, not a global store.
- **Ephemeral UI:** Component `$state` for forms, edit mode, import preview (`+page.svelte` files).
- **Optimistic class targets:** `class/[classId]/+page.svelte` keeps `classSnapshot` / target hour fields synced with `$effect` when `data.class` changes.
- **Toast:** Module-level `writable` in `src/lib/stores/toast.ts`.
- **Last class:** `localStorage` key `lesson-planner:last-class-id` set in `class/[classId]/+layout.svelte` via `$effect`.

## Key Abstractions

**`LessonPlannerDB` (Dexie):**
- Purpose: Single IndexedDB database `lesson-planner-db` with versioned schema (v1→v3 migrations for `sessionKind`, semester fields, `requiredStudentLessonHours`).
- Examples: `src/lib/db/client.ts`, row types in `src/lib/db/types.ts`
- Pattern: One exported `db` singleton; repos never instantiate Dexie directly.

**Repository modules:**
- Purpose: Entity-scoped persistence API; cascade deletes in transactions (`deleteClassCascade`, `deleteLessonCascade`, `deleteStudentCascade`).
- Examples: `src/lib/repos/classes.repo.ts`, `lessons.repo.ts`, `students.repo.ts`, `attendance.repo.ts`
- Pattern: Async functions returning rows or `void`; domain validation before `db.*.update`; `lessons.repo` delegates session-kind rules to `sessionKindPolicy`.

**`CustomLoadKey` + `depends` / `invalidate`:**
- Purpose: Fine-grained cache keys so student writes do not refetch lessons.
- Examples: `src/lib/kit/loadKeys.ts`, usage in every `+layout.ts` / `+page.ts` under `src/routes/`
- Pattern: `` `${namespace}:${segment}` `` strings; always use helpers, never ad-hoc strings.

**`runMutation`:**
- Purpose: Standard write pipeline (retry → invalidate → toast → optional callbacks).
- Examples: `src/lib/kit/runMutation.ts`, called from `+layout.svelte`, class pages, `SemesterMap.svelte`
- Pattern: Returns `{ ok: true, value } | { ok: false }`; repos throw `repoError(code)` for mapped messages.

**Session kind model:**
- Purpose: Lessons are `class` | `extra` | `skipped`; drives hours, done flag, attendance visibility, absence clearing.
- Examples: `LessonSessionKind` in `src/lib/db/types.ts`; policy in `src/lib/logic/sessionKindPolicy.ts`; enforcement in `src/lib/repos/lessons.repo.ts`
- Pattern: UI rules in `sessionKindPolicy` display helpers; write rules in same module + repo transactions.

**Contract / hour statistics:**
- Purpose: Teacher hours (60 min) vs student lesson hours (50 min), flex pool, unplanned class hours.
- Examples: `src/lib/logic/stats.ts`, consumed heavily in `src/routes/class/[classId]/+page.svelte`
- Pattern: Pure functions on lesson arrays; constants `TEACHER_MINUTES_PER_TEACHER_HOUR`, `STUDENT_MINUTES_PER_STUDENT_HOUR`.

## Entry Points

**Vite / SvelteKit app bootstrap:**
- Location: `src/app.html`, generated `.svelte-kit/` client entry
- Triggers: `bun run dev` / static `build/` after `adapter-static`
- Responsibilities: Mount SPA, client-side routing

**Root layout load:**
- Location: `src/routes/+layout.ts`, `src/routes/+layout.svelte`
- Triggers: Any navigation
- Responsibilities: Load all classes; global chrome (class switcher, create/rename/delete class, toast host)

**Home redirect:**
- Location: `src/routes/+page.ts`
- Triggers: Visit `/`
- Responsibilities: Empty-state or redirect to `/class/{id}`

**Class workspace:**
- Location: `src/routes/class/[classId]/+layout.ts`, `+layout.svelte`, `+page.ts`, `+page.svelte`
- Triggers: `/class/{classId}`
- Responsibilities: Class meta load; sub-nav Schedule/Students; schedule list, targets, semester map, lesson CRUD

**Students roster:**
- Location: `src/routes/class/[classId]/students/+page.ts`, `+page.svelte`
- Triggers: `/class/{classId}/students`
- Responsibilities: CRUD, CSV/TXT import via `src/lib/logic/rosterImport.ts`

**Lesson session editor:**
- Location: `src/routes/class/[classId]/lesson/[lessonId]/+page.ts`, `+page.svelte`
- Triggers: `/class/{classId}/lesson/{lessonId}`
- Responsibilities: Edit lesson fields; toggle absences when `attendanceVisibleForKind` (`class` only)

## Error Handling

**Strategy:** Throw `Error` with stable `message` codes from repos/domain; map to user copy in `REPO_ERROR_MESSAGES`; catch at `runMutation` boundary for toasts. HTTP-style `error(404)` only in load functions for missing entities.

**Patterns:**
- `repoError(RepoErrorCode.*)` from `src/lib/kit/repoErrors.ts` — e.g. extra session blocked when absences exist, class not found.
- Semester validation throws literal message strings also listed in `REPO_ERROR_MESSAGES` (`assertValidSemesterBounds` in `src/lib/logic/semesterCalendar.ts`).
- `runMutation` resolves message via `mapError` → `repoErrorMessage` → `errorToast` → `Error.message` → generic fallback.
- `withRetry` in `src/lib/db/withRetry.ts` skips retry for `ConstraintError`, `DataError`, `TypeError`.
- Load guards: `getClass` / `getLesson` mismatch → `error(404, ...)` in `+layout.ts` / `lesson/+page.ts`.

## Cross-Cutting Concerns

**Logging:** No structured logger; failures surface via toast only. Tests use Vitest assertions.

**Validation:** Semester start/end pairing in `mergeSemesterFields` / `assertValidSemesterBounds`; session-kind transitions in `assertCanChangeSessionKind`; form-level checks in Svelte (e.g. non-negative hours) before `runMutation`.

**Authentication:** Not applicable — single-user local app; no auth layer.

**Deployment shape:** `@sveltejs/adapter-static` with `fallback: 'index.html'` in `svelte.config.js`; output `build/` as static SPA (`README.md`).

---

*Architecture analysis: 2026-05-15*
