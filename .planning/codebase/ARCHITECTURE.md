# Architecture

**Analysis Date:** 2026-05-15

## Pattern Overview

**Overall:** Client-only layered SPA (SvelteKit + static adapter)

**Key Characteristics:**
- All persistence runs in the browser via IndexedDB (Dexie); there is no backend API or server runtime for data.
- SvelteKit provides routing, code-splitting, and `load` functions used as a **read/cache boundary** (not SSR).
- Domain rules live in pure TypeScript modules; UI routes call **repository** functions and **invalidate** scoped load keys after writes.
- `ssr = false` and `@sveltejs/adapter-static` with SPA fallback — deploy as static files only.

## Layers

**Presentation (routes & UI):**
- Purpose: Pages, navigation, forms, derived display state, user actions.
- Location: `src/routes/`
- Contains: `+page.svelte`, `+layout.svelte`, route-local components (e.g. `SemesterMap.svelte`), thin `+page.ts` / `+layout.ts` loaders.
- Depends on: `$lib/repos/*`, `$lib/logic/*`, `$lib/db/withRetry`, `$lib/kit/loadKeys`, `$lib/stores/toast`, `$lib/preferences/activeClass`.
- Used by: End user in the browser.

**Application loaders (SvelteKit data boundary):**
- Purpose: Fetch entities for routes, declare `depends()` keys, return serializable `PageData` / layout data.
- Location: `src/routes/**/+page.ts`, `src/routes/**/+layout.ts`, root `src/routes/+layout.ts`.
- Contains: `load` functions that call repos and `error(404)` when entities are missing.
- Depends on: Repositories, `loadKeys`.
- Used by: Matching `.svelte` pages via `data` props.

**Domain logic (pure):**
- Purpose: Business rules with no I/O — stats, calendar grids, roster parsing, session-kind UI rules, semester validation.
- Location: `src/lib/logic/`
- Contains: `stats.ts`, `semesterCalendar.ts`, `sessionKindUi.ts`, `rosterImport.ts` (+ co-located `*.test.ts`).
- Depends on: `$lib/db/types` only (types/constants).
- Used by: Repos (e.g. `classes.repo` → `semesterCalendar`), route components, loaders.

**Data access (repositories):**
- Purpose: CRUD and transactional cascades over Dexie tables; enforce invariants at write time.
- Location: `src/lib/repos/`
- Contains: `classes.repo.ts`, `lessons.repo.ts`, `students.repo.ts`, `attendance.repo.ts` (+ repo tests).
- Depends on: `$lib/db/client`, `$lib/db/types`, selected logic helpers.
- Used by: Load functions and route `.svelte` mutation handlers.

**Persistence:**
- Purpose: Schema, migrations, singleton DB instance, transient IndexedDB retry helper.
- Location: `src/lib/db/`
- Contains: `client.ts` (`LessonPlannerDB`), `types.ts`, `withRetry.ts`.
- Depends on: `dexie` package.
- Used by: All repositories.

**Cross-cutting utilities:**
- Purpose: Cache invalidation contract, UX feedback, session preference.
- Location: `src/lib/kit/loadKeys.ts`, `src/lib/stores/toast.ts`, `src/lib/preferences/activeClass.ts`.
- Depends on: SvelteKit navigation (invalidate) or browser APIs only.
- Used by: Layouts and pages after mutations.

## Data Flow

**Initial app load:**

1. Browser requests the SPA; SvelteKit hydrates with `ssr = false`.
2. Root `src/routes/+layout.ts` runs `load` → `listClasses()` → `{ classes }`.
3. `src/routes/+page.ts` reads parent data; if classes exist, `redirect(303)` to `/class/{id}` using `getLastClassId()` from `localStorage`, else `{ empty: true }`.
4. Class layout `src/routes/class/[classId]/+layout.ts` loads the class row or 404.

**Read path (typical class schedule page):**

1. `src/routes/class/[classId]/+page.ts` `depends(classLoadKey(classId))`, awaits parent, calls `listLessons(classId)`.
2. `+page.svelte` receives `data.class` and `data.lessons`; uses `$derived` + `src/lib/logic/stats.ts` for contract statistics.
3. `SemesterMap.svelte` receives `classRow` and `lessons` props; uses `semesterCalendar` for month grids and markers.

**Write path (typical mutation):**

1. User action in `.svelte` (e.g. toggle lesson done).
2. Handler wraps repo call in `withRetry(() => ...)` from `src/lib/db/withRetry.ts`.
3. On success, `invalidate(classLoadKey(id))` or `invalidate(lessonLoadKey(id))` or `invalidate(CLASSES_LIST_LOAD_KEY)` from `src/lib/kit/loadKeys.ts`.
4. Matching `load` functions re-run; UI `data` props update; local `$state` form fields resync via `$effect` where used.

**Lesson detail & attendance:**

1. `src/routes/class/[classId]/lesson/[lessonId]/+page.ts` loads lesson, students, and absent IDs (absences only when `attendanceVisibleForKind` is true for `sessionKind === 'class'`).
2. Toggles call `setAbsent` in `src/lib/repos/attendance.repo.ts` (composite id `lessonId__studentId`).
3. Session kind changes go through `updateLesson`, which may delete absences when switching to `skipped` or block `extra` if absences exist.

**State Management:**
- **Source of truth for lists/entities:** SvelteKit `load` return values (`data` prop), refreshed via `invalidate` + `depends` keys — not a global entity store.
- **Ephemeral UI state:** Svelte 5 `$state` / `$derived` in components (form fields, edit mode, import preview).
- **Cross-session preference:** `localStorage` key `lesson-planner:last-class-id` via `src/lib/preferences/activeClass.ts`.
- **Transient feedback:** `toastMessage` writable in `src/lib/stores/toast.ts`.

## Key Abstractions

**Entity rows (Dexie tables):**
- Purpose: Typed records for classes, students, lessons, absences.
- Examples: `src/lib/db/types.ts` — `ClassRow`, `StudentRow`, `LessonRow`, `AbsenceRow`, `LessonSessionKind`.
- Pattern: UUID string primary keys; ISO date strings (`YYYY-MM-DD`); numeric timestamps for `createdAt`.

**Repository functions:**
- Purpose: Single entry point per aggregate for reads/writes.
- Examples: `listLessons`, `createLesson`, `deleteClassCascade` in `src/lib/repos/`.
- Pattern: Async functions returning rows or `void`; multi-table deletes use `db.transaction('rw', ...)`.

**Load invalidation keys:**
- Purpose: Fine-grained reruns of `load` without full-page reload.
- Examples: `CLASSES_LIST_LOAD_KEY`, `classLoadKey(classId)`, `lessonLoadKey(lessonId)` in `src/lib/kit/loadKeys.ts`.
- Pattern: `depends(key)` in loaders; `invalidate(key)` after mutations affecting that data.

**Contract statistics:**
- Purpose: Teacher-hour vs student-hour (50-minute unit) accounting for class/extra/skipped sessions.
- Examples: `remainingFlexTeacherHours`, `unplannedClassTeacherHours` in `src/lib/logic/stats.ts`.
- Pattern: Pure functions over `LessonForContractStats[]` and class targets; UI only formats numbers.

**Session kind semantics:**
- Purpose: Unified rules for UI labels, editable fields, and attendance visibility.
- Examples: `attendanceVisibleForKind`, `normalizedHoursForKind` in `src/lib/logic/sessionKindUi.ts`.
- Pattern: `'class' | 'extra' | 'skipped'` drives repo behavior (e.g. zero hours, absence cleanup).

## Entry Points

**HTML shell:**
- Location: `src/app.html`
- Triggers: Initial document load.
- Responsibilities: Meta, `%sveltekit.head%` / `%sveltekit.body%`, preload `hover`.

**Root layout load:**
- Location: `src/routes/+layout.ts`
- Triggers: Any navigation (and invalidation of `app:classes`).
- Responsibilities: `export const ssr = false`, `prerender = false`, load all classes for header switcher.

**Home redirect:**
- Location: `src/routes/+page.ts`
- Triggers: Visit `/`.
- Responsibilities: Empty-state data or redirect to last/first class.

**Class-scoped layouts and pages:**
- Location: `src/routes/class/[classId]/+layout.ts`, `+page.ts`, nested `lesson/` and `students/` loaders.
- Triggers: `/class/:classId`, `/class/:classId/lesson/:lessonId`, `/class/:classId/students`.
- Responsibilities: Resolve params, 404 on missing entities, attach lessons/students/absences to `data`.

**Database singleton:**
- Location: `src/lib/db/client.ts` — `export const db = new LessonPlannerDB()`
- Triggers: First import of client from any repo or test.
- Responsibilities: Dexie v1–v3 schema and upgrades (session kinds, semester bounds).

**Production bundle:**
- Location: `build/` after `bun run build`
- Triggers: Static hosting with `index.html` fallback (`svelte.config.js` adapter-static).

## Error Handling

**Strategy:** Fail in repos/loaders with thrown `Error` or SvelteKit `error(404)`; catch at UI boundary, show toast, optionally revert optimistic local state.

**Patterns:**
- Loaders: `throw error(404, '...')` when `getClass` / `getLesson` miss or lesson `classId` mismatches route (`src/routes/class/[classId]/lesson/[lessonId]/+page.ts`).
- Repos: User-facing messages for semester bounds (`assertValidSemesterBounds`), domain code `SESSION_KIND_EXTRA_BLOCKED_ABSENCES` in `updateLesson` (`src/lib/repos/lessons.repo.ts`).
- UI: `try/catch` around `withRetry` + repo calls → `showToast('...')` (`src/lib/stores/toast.ts`); lesson kind change rolls back local `$state` on failure (`lesson/[lessonId]/+page.svelte`).
- IndexedDB: `withRetry` retries once unless error name is `ConstraintError`, `DataError`, or `TypeError` (`src/lib/db/withRetry.ts`).

## Cross-Cutting Concerns

**Logging:** No structured logger; errors surfaced via toasts and thrown `Error` messages only.

**Validation:** Domain validation in `src/lib/logic/` (semester dates, import parsing); numeric guards in components before repo calls; DB constraints via Dexie schema indexes.

**Authentication:** Not applicable — single-user local app, no accounts or remote auth.

---

*Architecture analysis: 2026-05-15*
