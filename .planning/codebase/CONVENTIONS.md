# Coding Conventions

**Analysis Date:** 2026-05-15

## Naming Patterns

**Files:**
- Repositories: `{entity}.repo.ts` in `src/lib/repos/` (e.g. `classes.repo.ts`, `lessons.repo.ts`)
- Pure logic: `{topic}.ts` in `src/lib/logic/` (e.g. `stats.ts`, `semesterCalendar.ts`)
- Tests: co-located `{module}.test.ts` beside the module under test
- SvelteKit routes: `+page.svelte`, `+page.ts`, `+layout.svelte`, `+layout.ts` under `src/routes/`
- Colocated UI components: PascalCase `.svelte` next to the route that owns them (e.g. `src/routes/class/[classId]/SemesterMap.svelte`)

**Functions:**
- Use `camelCase` for functions and methods
- Prefix list/get/create/update/delete for repo operations: `listClasses`, `getLesson`, `createClass`, `updateLesson`, `deleteClassCascade`
- Pure helpers use descriptive verb phrases: `sumScheduledHours`, `assertValidSemesterBounds`, `parseCsvNames`

**Variables:**
- `camelCase` for locals and parameters
- `const` by default; `let` only when reassignment is required (Svelte `$state`, loops)
- Boolean names read as predicates: `attendanceVisibleForKind`, `hoursEditableForKind`

**Types:**
- `PascalCase` for types and interfaces: `ClassRow`, `LessonSessionKind`, `ImportNamesResult`
- Domain ID aliases: `ClassId`, `StudentId`, `LessonId` in `src/lib/db/types.ts`
- String union literals for enums: `LessonSessionKind = 'class' | 'extra' | 'skipped'`
- Input shapes inline in function signatures or as small exported types; avoid separate `*Input` types unless reused

## Code Style

**Formatting:**
- No Prettier or ESLint config in the repo
- Indentation: tabs in TypeScript and Svelte (match existing files)
- Single quotes for strings in `.ts` / `<script>` blocks
- Trailing commas in multi-line objects and imports where already used

**Type checking:**
- Run `bun run check` (`svelte-kit sync` + `svelte-check` with `tsconfig.json`)
- `strict: true` in `tsconfig.json`; use explicit types on public exports and load functions
- Prefer `import type { ... }` for type-only imports

## Import Organization

**Order:**
1. Framework / runtime (`vitest`, `dexie`, `@sveltejs/kit`, `$app/*`)
2. Aliased app modules (`$lib/...`)
3. Relative value imports (`./classes.repo`)
4. Relative type imports (`import type { PageData } from './$types'`)

**Path aliases:**
- `$lib` → `src/lib/` (SvelteKit default)
- `./$types` in routes for generated `PageData`, `LayoutLoad`, etc.
- `$app/navigation`, `$app/paths`, `$app/state` for Kit client APIs

**Example (repo):**

```typescript
import { db } from '$lib/db/client';
import { assertValidSemesterBounds, mergeSemesterFields } from '$lib/logic/semesterCalendar';
import type { ClassId, ClassRow } from '$lib/db/types';
```

## Error Handling

**Repositories (`src/lib/repos/`):**
- Throw `new Error('...')` with a short human-readable message for invalid state (e.g. `'Class not found.'`)
- Throw stable machine-readable codes in the message when the UI must branch: `'SESSION_KIND_EXTRA_BLOCKED_ABSENCES'` in `src/lib/repos/lessons.repo.ts`
- Delegate validation to pure logic where possible (`assertValidSemesterBounds` in `src/lib/logic/semesterCalendar.ts`) before persisting
- Use Dexie `transaction('rw', ...)` for multi-table writes; early-return inside transaction if row missing (e.g. `updateLesson` when lesson not found)

**UI (`.svelte` routes and layout):**
- Wrap IndexedDB mutations in `withRetry(() => repoFn(...))` from `src/lib/db/withRetry.ts`
- `try` / `catch` with empty catch or minimal handling; call `showToast('...')` from `src/lib/stores/toast.ts` for user-visible failures
- Inspect `e instanceof Error` and `e.message` when a specific repo error needs custom copy (see `changeSessionKind` in `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`)
- Use SvelteKit `error(404, '...')` in load functions when resources are missing (`src/routes/class/[classId]/lesson/[lessonId]/+page.ts`)

**Retries:**
- Default one retry for transient IndexedDB errors via `withRetry(fn, { retries?: number })`
- Non-retriable Dexie errors (`ConstraintError`, `DataError`, `TypeError`) are not retried (`src/lib/db/withRetry.ts`)

## Logging

**Framework:** No structured logger; avoid `console.log` in application code.

**Patterns:**
- User-facing failures → `showToast(message)` (auto-clears after 4s)
- No server-side logging (static SPA, `ssr = false` in `src/routes/+layout.ts`)

## Comments

**When to comment:**
- Module-level JSDoc for cross-cutting constants and non-obvious domain rules (e.g. teacher vs student hour conversion in `src/lib/logic/stats.ts`)
- File-level doc block when defining shared contracts (`src/lib/kit/loadKeys.ts`)
- Inline comments for schema migrations and upgrade backfills in `src/lib/db/client.ts`

**JSDoc/TSDoc:**
- Use `/** ... */` on exported constants and public helpers where the name alone is insufficient
- Do not add JSDoc to every trivial getter or one-line wrapper

## Function Design

**Size:** Keep repos thin; put calculations and date rules in `src/lib/logic/`. UI event handlers may be longer but should delegate persistence to repos.

**Parameters:**
- Repos accept `ClassId` / ids and small input objects: `createClass({ name, totalHoursTarget, ... })`
- Patches use `Partial<Pick<Row, 'field' | ...>>` for updates

**Return values:**
- Async repos return `Promise<Row>` for creates, `Promise<Row[]>` for lists, `Promise<void>` for updates/deletes
- Pure functions return primitives or plain objects; no throwing for expected validation in UI—use `assertValidSemesterBounds` which throws only when bounds are invalid

## Module Design

**Exports:** Named exports only; no default exports in `src/lib/`

**Barrel files:** Avoid aggregating barrels. `src/lib/index.ts` is a placeholder comment only—import from concrete paths (`$lib/repos/classes.repo`, `$lib/logic/stats`)

**Layering:**
- `src/lib/db/` — Dexie client, types, retry helper
- `src/lib/repos/` — persistence API (only layer that imports `db` directly for CRUD)
- `src/lib/logic/` — pure functions; may import types from `$lib/db/types`, not `db`
- `src/lib/stores/` — client UI state (`toast`)
- `src/lib/preferences/` — `localStorage` helpers
- `src/lib/kit/` — SvelteKit load invalidation keys
- `src/routes/` — loads fetch via repos; components call repos + `invalidate(loadKey)`

## Svelte 5 Conventions

**Runes (use consistently):**
- Props: `let { data }: { data: PageData } = $props();`
- Local UI state: `$state(initial)`
- Derived values: `$derived(expression)`
- Side effects syncing props → local state: `$effect(() => { ... })`
- List keys: `{#each items as item (item.id)}`

**Events:** Use `onclick`, `onchange`, etc. (not legacy `on:click`)

**Styles:** Component-scoped `<style>` blocks; shared layout chrome in `src/routes/+layout.svelte`

**Load invalidation:** Define keys in `src/lib/kit/loadKeys.ts`; call `depends(key)` in `+page.ts` / `+layout.ts` and `invalidate(key)` after mutations

## TypeScript Conventions

- Export row shapes from `src/lib/db/types.ts`; repos and components import from there
- Use `satisfies` for literal load keys: `export const CLASSES_LIST_LOAD_KEY = 'app:classes' satisfies CustomLoadKey`
- Guard browser-only APIs: `typeof localStorage === 'undefined'` in `src/lib/preferences/activeClass.ts`
- Dates in persistence: ISO `YYYY-MM-DD` strings, not `Date` objects in Dexie rows

## IDs and Keys

- Primary keys: `crypto.randomUUID()` at create time
- Composite absence id: `` `${lessonId}__${studentId}` `` in `src/lib/repos/attendance.repo.ts`
- `localStorage` keys: prefixed constant `lesson-planner:last-class-id` in preferences module

---

*Convention analysis: 2026-05-15*
