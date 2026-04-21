# Coding Conventions

**Analysis Date:** 2026-04-21

## Naming Patterns

**Files:**
- Use lowercase feature filenames with role suffixes for data access and logic modules: `src/lib/repos/lessons.repo.ts`, `src/lib/repos/students.repo.ts`, `src/lib/logic/sessionKindUi.ts`.
- Use SvelteKit route naming (`+page.svelte`, `+layout.ts`, `+page.ts`) under nested route directories: `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/lesson/[lessonId]/+page.ts`.
- Keep tests co-located with source using `.test.ts`: `src/lib/repos/lessons.repo.test.ts`, `src/lib/logic/stats.test.ts`, `src/lib/logic/sessionKindUi.test.ts`.

**Functions:**
- Use `camelCase` and verb-first naming for side-effecting functions (`createLesson`, `updateLesson`, `replaceStudents`, `persistLessonMeta`).
- Use intent-focused pure-function names for calculations and UI derivations (`remainingFlexTeacherHours`, `labelForTitleField`, `hoursEditableForKind`).

**Variables:**
- Use explicit state names in Svelte rune state (`newSessionKind`, `previewSkipped`, `loadedLessonId`, `targetStudentLessonHours`) in `src/routes/class/[classId]/**/*.svelte`.
- Use concise local symbols only for bounded contract math (`tClass`, `tExtra`, `cMin`) in `src/lib/logic/stats.ts` and `src/routes/class/[classId]/+page.svelte`.

**Types:**
- Keep canonical domain unions and row types in `src/lib/db/types.ts`; extend behavior around `LessonSessionKind` there first.
- Use narrow return types for parser and helper APIs (`ImportNamesResult` in `src/lib/logic/rosterImport.ts`, literal-return helpers in `src/lib/logic/sessionKindUi.ts`).

## Code Style

**Formatting:**
- No dedicated formatter config is detected (`.prettierrc*`, `eslint.config.*`, `.eslintrc*` are not present); mirror repository style.
- Use tabs, semicolons, single quotes, and trailing commas in multiline literals as shown in `src/lib/repos/lessons.repo.ts` and `src/routes/class/[classId]/+page.svelte`.

**Linting:**
- Treat `bun run check` from `package.json` as the quality gate for TS/Svelte static correctness.
- Keep strict TypeScript compatibility from `tsconfig.json` (`"strict": true`, `"checkJs": true`) and avoid implicit `any`.

## Import Organization

**Order:**
1. Framework/runtime imports (`svelte`, `@sveltejs/*`, `$app/*`) as in `src/routes/class/[classId]/+page.svelte`.
2. Internal feature imports via `$lib/*` (`$lib/repos/*`, `$lib/logic/*`, `$lib/db/*`, `$lib/stores/*`).
3. Type-only imports (`import type`) after runtime imports in the same module.
4. Relative imports for same-folder code/tests (`./stats`, `./rosterImport`, `./lessons.repo`).

**Path Aliases:**
- Use `$lib` for app modules; avoid deep relative paths for shared code (`src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`).
- Use `$app` aliases only for SvelteKit runtime surfaces (`$app/paths` in `src/routes/class/[classId]/+page.svelte`).

## Error Handling

**Patterns:**
- Wrap UI-side writes in `try/catch` and surface user messages with `showToast` (`src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/students/+page.svelte`).
- Use domain-specific error strings in repos for rule violations (`SESSION_KIND_EXTRA_BLOCKED_ABSENCES` in `src/lib/repos/lessons.repo.ts`), then map to UX-friendly messages in route components.
- Enforce cross-table consistency with Dexie transactions in repository mutators (`src/lib/repos/lessons.repo.ts`, `src/lib/repos/classes.repo.ts`, `src/lib/repos/students.repo.ts`).
- Keep `skipped` session invariants in data layer, not only UI: coerce `durationHours` to `0` and clear absences on transition in `src/lib/repos/lessons.repo.ts`.

## Logging

**Framework:** UI toast store (`src/lib/stores/toast.ts`); console logging is not a standard pattern.

**Patterns:**
- Prefer user-facing toast messages over `console.*` in route actions.
- Keep thrown errors deterministic for assertion in tests (`src/lib/repos/lessons.repo.test.ts`, `src/lib/db/withRetry.test.ts`).

## Comments

**When to Comment:**
- Add short rationale comments only when domain math or state guards are non-obvious (`src/lib/logic/stats.ts`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`).
- Do not add comments for straightforward CRUD or obvious JSX/Svelte markup paths.

**JSDoc/TSDoc:**
- Use concise block comments on exported utility functions when business semantics need context (`src/lib/logic/stats.ts`).
- Keep comments synchronized with contract behavior, including `class`/`extra`/`skipped` session distinctions.

## Function Design

**Size:** 
- Keep logic helpers small and pure in `src/lib/logic/*.ts`; compose behavior through focused exported functions.
- Keep repository functions single-responsibility and table-scoped, with transactions only where required for atomicity.

**Parameters:**
- Use object parameters for create/update APIs with multiple optional fields (`createLesson`, `updateLesson` in `src/lib/repos/lessons.repo.ts`).
- Use scalar parameters for targeted operations (`setAbsent(lessonId, studentId, absent)` in `src/lib/repos/attendance.repo.ts`).

**Return Values:**
- Return created entities from create methods and `Promise<void>` from mutation-only updates/deletes (`src/lib/repos/*.repo.ts`).
- Return deterministic scalar/object outputs from pure logic (`src/lib/logic/rosterImport.ts`, `src/lib/logic/sessionKindUi.ts`, `src/lib/logic/stats.ts`).

## Module Design

**Exports:**
- Use named exports for feature modules (`src/lib/repos/*.ts`, `src/lib/logic/*.ts`, `src/lib/db/*.ts`); avoid default exports outside SvelteKit config files.
- Keep route components as orchestration layers that call `$lib` modules; keep persistence and business rules outside route files.

**Barrel Files:**
- Barrel usage is minimal (`src/lib/index.ts`); prefer direct module imports to preserve explicit ownership boundaries.

---

*Convention analysis: 2026-04-21*
