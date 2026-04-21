# Architecture

**Analysis Date:** 2026-04-21

## Pattern Overview

**Overall:** Client-only layered SPA architecture (SvelteKit route UI + repository data access + Dexie persistence + pure domain logic helpers).

**Key Characteristics:**
- UI routes in `src/routes/` orchestrate user interactions and render derived state.
- Repository modules in `src/lib/repos/` encapsulate all IndexedDB table reads/writes.
- Domain/stat math in `src/lib/logic/` is pure and reusable across pages/tests.

## Layers

**Presentation Layer (Routes + Components):**
- Purpose: Render class/schedule/students/lesson views and trigger user actions.
- Location: `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/students/+page.svelte`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`.
- Contains: Svelte state (`$state`, `$derived`, `$effect`), form handlers, navigation, and toast feedback.
- Depends on: Repositories (`$lib/repos/*`), logic helpers (`$lib/logic/stats`, `$lib/logic/rosterImport`), and utility/store modules (`$lib/db/withRetry`, `$lib/stores/toast`).
- Used by: End users via SvelteKit route entrypoints.

**Route Load/Guard Layer:**
- Purpose: Validate route params and hydrate route-level data before rendering.
- Location: `src/routes/class/[classId]/+layout.ts`, `src/routes/class/[classId]/lesson/[lessonId]/+page.ts`.
- Contains: `load` functions that enforce existence checks and throw 404 via `error(...)`.
- Depends on: Repository getters (`getClass`, `getLesson`).
- Used by: Matched class and lesson routes.

**Repository Layer:**
- Purpose: Centralize CRUD, sorting, and transactional/cascade rules over persisted entities.
- Location: `src/lib/repos/classes.repo.ts`, `src/lib/repos/lessons.repo.ts`, `src/lib/repos/students.repo.ts`, `src/lib/repos/attendance.repo.ts`.
- Contains: High-level operations (`createLesson`, `deleteClassCascade`, `replaceStudents`, `setAbsent`).
- Depends on: `src/lib/db/client.ts` and row types in `src/lib/db/types.ts`.
- Used by: Route load functions and route Svelte files.

**Persistence Layer:**
- Purpose: Define IndexedDB schema, versions, and migration/backfill behavior.
- Location: `src/lib/db/client.ts`, `src/lib/db/types.ts`.
- Contains: `LessonPlannerDB` (Dexie), table definitions (`classes`, `students`, `lessons`, `absences`), v2 migration defaults.
- Depends on: Dexie runtime (`dexie` package).
- Used by: All repository modules and DB-focused tests.

**Domain Logic Layer:**
- Purpose: Isolate deterministic calculations/parsers from UI and persistence concerns.
- Location: `src/lib/logic/stats.ts`, `src/lib/logic/rosterImport.ts`.
- Contains: Contract/session-kind hour metrics and CSV/TXT import parsing.
- Depends on: Type-only dependency on `LessonSessionKind` from `src/lib/db/types.ts`.
- Used by: Schedule and students routes, plus unit tests.

## Data Flow

**Class Schedule and Contract Stats Flow:**
1. `src/routes/class/[classId]/+layout.ts` loads class row by route param.
2. `src/routes/class/[classId]/+page.svelte` fetches lessons via `listLessons` and user updates via repo methods.
3. Page computes derived contract metrics (`unplannedClassTeacherHours`, `remainingFlexTeacherHours`, counts by kind) through `src/lib/logic/stats.ts`.
4. Repository calls persist updates in Dexie tables via `src/lib/db/client.ts`.

**Lesson Detail and Attendance Flow:**
1. `src/routes/class/[classId]/lesson/[lessonId]/+page.ts` loads and validates lesson ownership.
2. `+page.svelte` edits lesson metadata through `updateLesson` and attendance through `setAbsent`.
3. `src/lib/repos/lessons.repo.ts` enforces session-kind invariant when switching to `extra` (blocked if absences exist).
4. Attendance is conditionally read/rendered for `class` sessions via `listAbsentStudentIds`.

**State Management:**
- UI state is local to components via Svelte 5 runes.
- Cross-view preference state uses `localStorage` helper `src/lib/preferences/activeClass.ts`.
- Transient feedback state uses writable store `src/lib/stores/toast.ts`.

## Key Abstractions

**Entity Rows (`ClassRow`, `LessonRow`, `StudentRow`, `AbsenceRow`):**
- Purpose: Canonical persisted model contracts.
- Examples: `src/lib/db/types.ts`.
- Pattern: Shared type definitions imported by repos, routes, and logic.

**Repository Transaction Boundaries:**
- Purpose: Ensure multi-table consistency for deletes and invariants.
- Examples: `deleteClassCascade` in `src/lib/repos/classes.repo.ts`, `updateLesson` guard transaction in `src/lib/repos/lessons.repo.ts`.
- Pattern: Dexie `db.transaction('rw', ...)` wraps related writes.

## Entry Points

**App Shell:**
- Location: `src/routes/+layout.svelte`.
- Triggers: Every app navigation.
- Responsibilities: Class switcher, create/rename/delete class actions, toast rendering.

**Root Redirect/Empty-State:**
- Location: `src/routes/+page.svelte`.
- Triggers: `/` route load on mount.
- Responsibilities: Resolve last active class and route to `/class/[id]` or show empty state.

**Class Feature Surface:**
- Location: `src/routes/class/[classId]/+page.svelte` and `src/routes/class/[classId]/students/+page.svelte`.
- Triggers: Navigation to schedule/students tabs.
- Responsibilities: Session planning/stats and roster management/import.

## Error Handling

**Strategy:** Localized route/UI catches with user-facing toast, plus explicit route-load 404 guards.

**Patterns:**
- Route guard failures throw `error(404, ...)` in `+layout.ts` and `+page.ts` loaders.
- Mutations use `withRetry(...)` from `src/lib/db/withRetry.ts` and catch to show contextual toast messages.
- Business-rule errors use explicit error tokens (`SESSION_KIND_EXTRA_BLOCKED_ABSENCES`) from repo layer.

## Cross-Cutting Concerns

**Logging:** Not implemented; user feedback is UI toasts (`src/lib/stores/toast.ts`).
**Validation:** Input checks in route components; persistence/business invariants in repositories.
**Authentication:** Not applicable (no server/auth layer; browser-local app).

## Impact of New Business Logic

- Contract planning logic (N teacher hours + M student lesson hours) centralizes in `src/lib/logic/stats.ts` and shifts schedule view from simple totals to multi-metric contract analysis in `src/routes/class/[classId]/+page.svelte`.
- Domain model expanded with `requiredStudentLessonHours` and `sessionKind` in `src/lib/db/types.ts`, with backward-compatible Dexie migration/backfill in `src/lib/db/client.ts` version 2.
- Module boundary strengthened: lesson-kind integrity now enforced in repository (`src/lib/repos/lessons.repo.ts`) rather than UI-only checks.
- Attendance control flow is now session-kind-aware in `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`, reducing invalid state combinations (extra session with absences).

---

*Architecture analysis: 2026-04-21*
