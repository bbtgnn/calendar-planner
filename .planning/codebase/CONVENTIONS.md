# Coding Conventions

**Analysis Date:** 2026-04-21

## Naming Patterns

**Files:**
- Use lowercase feature names with dot-suffix role markers for data modules: `src/lib/repos/classes.repo.ts`, `src/lib/repos/lessons.repo.ts`, `src/lib/db/withRetry.ts`.
- Use SvelteKit route conventions for pages/layout/loaders: `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/+layout.ts`, `src/routes/class/[classId]/lesson/[lessonId]/+page.ts`.
- Use colocated test files with `.test.ts`: `src/lib/logic/stats.test.ts`, `src/lib/repos/lessons.repo.test.ts`.

**Functions:**
- Use `camelCase` for functions and handlers (`createLesson`, `deleteClassCascade`, `persistLessonMeta`, `changeSessionKind`).
- Use verb-led names for side-effecting functions (`addStudent`, `updateClass`, `setAbsent`) and noun/metric names for pure calculations (`remainingHours`, `maxExtraTeacherHours`).

**Variables:**
- Use concise domain symbols for intermediate math in business logic only when scoped and documented (`tClass`, `tExtra`, `cMin` in `src/lib/logic/stats.ts` and `src/routes/class/[classId]/+page.svelte`).
- Use explicit booleans and nullable sentinels for UI state (`loading`, `empty`, `editingId`, `fileKind`).

**Types:**
- Centralize domain row/id/value types in `src/lib/db/types.ts`.
- Use explicit exported type aliases for clarity and migration compatibility (`LessonForContractStats`, `LessonForStats` in `src/lib/logic/stats.ts`).

## Code Style

**Formatting:**
- No standalone formatter config detected (`.prettierrc*` and `eslint*` are not present); follow existing style in repository.
- Match current formatting: tabs for indentation, semicolons, single quotes, trailing commas in multiline objects/arrays (e.g. `src/lib/repos/lessons.repo.ts`, `src/routes/+layout.svelte`).

**Linting:**
- Static checks are TypeScript + Svelte checks via `bun run check` (`package.json`, `tsconfig.json`).
- Keep `strict` TypeScript compatibility (`tsconfig.json`) and avoid implicit `any`.

## Import Organization

**Order:**
1. Framework/runtime imports (`@sveltejs/kit`, `$app/*`, `svelte`).
2. App aliases (`$lib/*`) for repositories, logic, stores.
3. Type-only imports grouped near runtime imports (`import type ...`).
4. Relative imports for same-folder units/tests (`./stats`, `./rosterImport`).

**Path Aliases:**
- Prefer `$lib` for internal shared modules (`$lib/repos/*`, `$lib/db/*`, `$lib/logic/*`).
- Use `$app` aliases only for SvelteKit runtime APIs (`$app/navigation`, `$app/state`, `$app/environment`).

## Error Handling

**Patterns:**
- Route loaders fail fast with HTTP errors for missing entities (`src/routes/class/[classId]/+layout.ts`, `src/routes/class/[classId]/lesson/[lessonId]/+page.ts`).
- Repository layer throws domain-specific `Error` messages for business rules (`SESSION_KIND_EXTRA_BLOCKED_ABSENCES` in `src/lib/repos/lessons.repo.ts`).
- UI handlers wrap persistence calls in `try/catch`, show user-safe messages through `showToast`, and avoid leaking raw errors (`src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/students/+page.svelte`).
- Use `withRetry` for write flows where transient IndexedDB failures are acceptable (`src/lib/db/withRetry.ts` and usage across `src/routes/**/*.svelte`).

## Logging

**Framework:** None detected (`console.*` logging pattern is not used in `src/`).

**Patterns:**
- Favor user feedback through UI toast state (`src/lib/stores/toast.ts`) instead of console logging.
- Preserve deterministic thrown messages in repository/business logic for callers/tests to assert.

## Comments

**When to Comment:**
- Add short comments for domain conversions and contract formulas (`src/lib/logic/stats.ts`).
- Add rationale comments around subtle state-sync behavior (`loadedLessonId` reseed guard in `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`).

**JSDoc/TSDoc:**
- Use brief block comments on exported utility functions where domain semantics are non-obvious (teacher-hour vs student-hour conversions in `src/lib/logic/stats.ts`).
- Avoid redundant comments on straightforward CRUD operations in repo modules.

## Function Design

**Size:**
- Keep business-logic functions small and composable (`src/lib/logic/stats.ts`, `src/lib/logic/rosterImport.ts`).
- Keep repository functions single-purpose and table-focused, using Dexie transactions only when cross-table consistency is required (`src/lib/repos/classes.repo.ts`, `src/lib/repos/students.repo.ts`).

**Parameters:**
- Prefer typed object parameters when calls have 3+ fields (`createLesson`, `createClass`).
- Use scalar parameters for focused updates (`updateStudent(id, name)`, `setAbsent(lessonId, studentId, absent)`).

**Return Values:**
- Return created rows from create operations and `Promise<void>` for updates/deletes (`src/lib/repos/*.repo.ts`).
- Return pure computed numbers/collections from logic functions without side effects (`src/lib/logic/stats.ts`, `src/lib/logic/rosterImport.ts`).

## Module Design

**Exports:**
- Use named exports exclusively; no default exports in app modules (`src/lib/repos/*.ts`, `src/lib/logic/*.ts`, `src/lib/db/*.ts`).
- Keep cross-layer boundaries explicit: UI imports repos/logic, repos import db/types, logic modules stay persistence-agnostic.

**Barrel Files:**
- Barrel usage is minimal (`src/lib/index.ts` placeholder only); import concrete modules directly to keep ownership clear.

## Architecture & Maintainability Conventions

- Keep route components thin on persistence details by delegating DB operations to `src/lib/repos/*` and computation to `src/lib/logic/*`.
- Preserve transaction boundaries for cascading deletes and consistency (`deleteClassCascade`, `deleteLessonCascade`, `replaceStudents`).
- Keep client-only assumptions explicit in app shell (`src/routes/+layout.ts` sets `ssr = false`, `prerender = false`) and preference helpers guarded for browser runtime (`src/lib/preferences/activeClass.ts`).
- Maintain deterministic ordering before rendering lists (`listLessons` sorts by date/id, `listStudents` sorts by name) to keep UI stable and tests predictable.

---

*Convention analysis: 2026-04-21*
