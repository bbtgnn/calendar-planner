# Architecture

**Analysis Date:** 2026-04-21

## Pattern Overview

**Overall:** Client-only layered SvelteKit SPA with route orchestration in `src/routes/`, domain logic in `src/lib/logic/`, repository boundaries in `src/lib/repos/`, and IndexedDB persistence in `src/lib/db/`.

**Key Characteristics:**
- Keep UI state and interactions in route Svelte files, not in database modules.
- Keep all persistence invariants and cascades in repositories (`src/lib/repos/*.ts`).
- Keep deterministic computations and UI-kind rules pure in logic modules (`src/lib/logic/*.ts`).

## Layers

**Presentation Layer:**
- Purpose: Render app shell, class schedule, lesson detail, and student roster experiences.
- Location: `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/routes/class/[classId]/+layout.svelte`, `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`, `src/routes/class/[classId]/students/+page.svelte`.
- Contains: Svelte runes state (`$state`, `$derived`, `$effect`), event handlers, form controls, navigation, and toast triggers.
- Depends on: `src/lib/repos/*.ts`, `src/lib/logic/stats.ts`, `src/lib/logic/sessionKindUi.ts`, `src/lib/logic/rosterImport.ts`, `src/lib/db/withRetry.ts`, `src/lib/stores/toast.ts`.
- Used by: End users via SvelteKit routes.

**Route Load/Guard Layer:**
- Purpose: Validate dynamic params and load required entities before view render.
- Location: `src/routes/class/[classId]/+layout.ts`, `src/routes/class/[classId]/lesson/[lessonId]/+page.ts`.
- Contains: `load` guards that return entity payloads or throw `error(404, ...)`.
- Depends on: `src/lib/repos/classes.repo.ts`, `src/lib/repos/lessons.repo.ts`.
- Used by: Class-scoped and lesson-scoped route trees.

**Repository Layer:**
- Purpose: Centralize CRUD, transactional guarantees, and business invariants.
- Location: `src/lib/repos/classes.repo.ts`, `src/lib/repos/lessons.repo.ts`, `src/lib/repos/students.repo.ts`, `src/lib/repos/attendance.repo.ts`.
- Contains: List/get/create/update/delete APIs, cascade delete flows, and session-kind transition constraints.
- Depends on: `src/lib/db/client.ts`, `src/lib/db/types.ts`.
- Used by: All route load files and route Svelte pages.

**Persistence Layer:**
- Purpose: Define storage schema, indexes, and migration backfills.
- Location: `src/lib/db/client.ts`, `src/lib/db/types.ts`.
- Contains: Dexie database class (`LessonPlannerDB`), table declarations, schema v1/v2 definitions, and v2 backfill for `requiredStudentLessonHours` and `sessionKind`.
- Depends on: `dexie` from `package.json`.
- Used by: Repository modules and DB smoke tests.

**Domain Logic Layer:**
- Purpose: Isolate pure calculations and UI-kind behavior from route rendering and IO.
- Location: `src/lib/logic/stats.ts`, `src/lib/logic/sessionKindUi.ts`, `src/lib/logic/rosterImport.ts`.
- Contains: Contract metrics, session-kind behavior flags/labels, CSV/TXT roster parsing.
- Depends on: Type imports from `src/lib/db/types.ts` only.
- Used by: Schedule and lesson routes plus logic/repository tests.

## Data Flow

**Schedule Planning Flow (with skipped support):**
1. `src/routes/class/[classId]/+layout.ts` resolves the active class via `getClass`.
2. `src/routes/class/[classId]/+page.svelte` fetches sessions via `listLessons` from `src/lib/repos/lessons.repo.ts`.
3. Add/edit controls apply kind-aware rules from `src/lib/logic/sessionKindUi.ts` (for `skipped`, force 0 hours and disable done/hours editing).
4. `createLesson` and `updateLesson` in `src/lib/repos/lessons.repo.ts` enforce persistence invariants (`skipped` always 0 hours; transition to `skipped` clears absences).
5. Derived stats in `src/lib/logic/stats.ts` count class and extra sessions while excluding `skipped` rows from class/extra completion metrics.

**Lesson Detail and Attendance Flow:**
1. `src/routes/class/[classId]/lesson/[lessonId]/+page.ts` validates lesson ownership (`lesson.classId === params.classId`).
2. `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte` edits session metadata through `updateLesson`.
3. When session kind becomes `skipped`, repository transaction clears `src/lib/db/client.ts` `absences` rows for that lesson and persists `durationHours = 0`.
4. Attendance UI loads absent IDs with `listAbsentStudentIds` only when `attendanceVisibleForKind(sessionKind)` from `src/lib/logic/sessionKindUi.ts` returns true (`class` only).

**Class and Student Management Flow:**
1. `src/routes/+layout.svelte` manages class lifecycle through `src/lib/repos/classes.repo.ts`.
2. `src/routes/class/[classId]/students/+page.svelte` manages roster CRUD/import through `src/lib/repos/students.repo.ts` and `src/lib/logic/rosterImport.ts`.
3. Cascade operations (`deleteClassCascade`, `deleteStudentCascade`, `replaceStudents`) remove dependent absence rows transactionally.

**State Management:**
- Route-local state uses Svelte 5 runes in each page module.
- Cross-route active class preference uses `src/lib/preferences/activeClass.ts` with `localStorage`.
- Transient user feedback uses `src/lib/stores/toast.ts`.

## Key Abstractions

**Entity Contracts:**
- Purpose: Define canonical data model for all app layers.
- Examples: `ClassRow`, `LessonRow`, `LessonSessionKind`, `StudentRow`, `AbsenceRow` in `src/lib/db/types.ts`.
- Pattern: Import these types across route, logic, and repository modules to keep shape consistency.

**Session Kind Behavior Contract:**
- Purpose: Keep UI behavior for `class`, `extra`, and `skipped` centralized and reusable.
- Examples: `normalizedHoursForKind`, `doneEditableForKind`, `attendanceVisibleForKind` in `src/lib/logic/sessionKindUi.ts`.
- Pattern: Route components call pure helpers before persistence calls.

**Repository Transaction Boundaries:**
- Purpose: Prevent partial writes when enforcing invariants or cascade deletes.
- Examples: `updateLesson` in `src/lib/repos/lessons.repo.ts`, `deleteClassCascade` in `src/lib/repos/classes.repo.ts`, `replaceStudents` in `src/lib/repos/students.repo.ts`.
- Pattern: Wrap multi-table operations in `db.transaction('rw', ...)`.

## Entry Points

**App Shell Entry Point:**
- Location: `src/routes/+layout.svelte`.
- Triggers: Every route render.
- Responsibilities: Class switcher, class CRUD controls, toast display, top-level layout container.

**Root Route Entry Point:**
- Location: `src/routes/+page.svelte`.
- Triggers: `"/"` navigation.
- Responsibilities: Resolve last active class (`src/lib/preferences/activeClass.ts`) and redirect to `/class/[classId]` or show empty state.

**Class Workspace Entry Points:**
- Location: `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/students/+page.svelte`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`.
- Triggers: Class workspace navigation and lesson deep links.
- Responsibilities: Contract/schedule planning, student roster management/import, lesson detail and attendance editing.

## Error Handling

**Strategy:** Keep failures local to interaction scope, surface user-friendly toast messages, and enforce route-level 404 guards for invalid IDs.

**Patterns:**
- Throw `error(404, ...)` in loaders (`src/routes/class/[classId]/+layout.ts`, `src/routes/class/[classId]/lesson/[lessonId]/+page.ts`) when entities are missing.
- Wrap write operations with `withRetry(...)` from `src/lib/db/withRetry.ts` and show toast on failure.
- Use explicit repository error token `SESSION_KIND_EXTRA_BLOCKED_ABSENCES` in `src/lib/repos/lessons.repo.ts` for invalid class->extra transitions.

## Cross-Cutting Concerns

**Logging:** No structured logging framework detected; user feedback is toast-based (`src/lib/stores/toast.ts`).
**Validation:** Input validation in route handlers, domain invariants in repositories, and behavior constraints in `src/lib/logic/sessionKindUi.ts`.
**Authentication:** Not applicable; app is browser-local with no server auth layer.

---

*Architecture analysis: 2026-04-21*
