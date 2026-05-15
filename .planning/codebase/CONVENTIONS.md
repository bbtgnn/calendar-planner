# Coding Conventions

**Analysis Date:** 2026-05-15

## Naming Patterns

**Files:**
- Use **camelCase** for TypeScript modules: `runMutation.ts`, `semesterCalendar.ts`, `sessionKindPolicy.ts`.
- Suffix **repositories** with `.repo.ts`: `classes.repo.ts`, `lessons.repo.ts`, `students.repo.ts`, `attendance.repo.ts`.
- Co-locate **tests** as `*.test.ts` beside the module under test: `stats.test.ts` next to `stats.ts`.
- Svelte routes follow SvelteKit conventions: `+page.svelte`, `+page.ts`, `+layout.svelte`, `+layout.ts` under `src/routes/`.
- Colocate route-only components next to the route: `src/routes/class/[classId]/SemesterMap.svelte`.

**Functions:**
- Use **camelCase** for functions and methods: `listClasses`, `runMutation`, `assertValidSemesterBounds`.
- Prefix **boolean predicates** with `is` / `has` where applicable: `isDateInSemester`, `attendanceVisibleForKind`.
- Prefix **assertions that throw** with `assert`: `assertCanChangeSessionKind`, `assertValidSemesterBounds`.
- Use **async** on all repo and mutation entry points; repos return `Promise<T>`.

**Variables:**
- Use **camelCase** for locals and parameters: `classId`, `targetHours`, `nextKind`.
- Use **SCREAMING_SNAKE_CASE** only for true constants: `CLASSES_LIST_LOAD_KEY`, `RepoErrorCode`, `TEACHER_MINUTES_PER_TEACHER_HOUR`.

**Types:**
- Use **PascalCase** for types and interfaces: `ClassRow`, `LessonSessionKind`, `RunMutationOptions`.
- Define shared row shapes and ID aliases in `src/lib/db/types.ts` (`ClassId`, `LessonRow`, etc.).
- Use `type` aliases for unions and small shapes; use `interface` sparingly (e.g. empty `App` namespace in `src/app.d.ts`).
- Export policy/helper types from the module that owns them: `LessonFieldPatch` in `src/lib/logic/sessionKindPolicy.ts`, `LessonForContractStats` in `src/lib/logic/stats.ts`.

## Code Style

**Formatting:**
- **Tabs** for indentation (consistent across `src/`).
- **Single quotes** for strings in TypeScript/Svelte script blocks.
- **Trailing commas** in multi-line objects/arrays where already used in the file.
- No Prettier, ESLint, or Biome config in the repo — rely on TypeScript strict mode and Svelte checking.

**Type checking:**
- Run `bun run check` (`svelte-kit sync` + `svelte-check` with `tsconfig.json`).
- `tsconfig.json` enables `strict: true`, `checkJs: true`, `forceConsistentCasingInFileNames: true`, `sourceMap: true`.
- Use explicit return types on exported functions in `src/lib/logic/` and `src/lib/kit/` when the signature is part of the public contract.

**Linting:**
- Not detected (no `.eslintrc`, `eslint.config.*`, or `biome.json`).
- Treat **`bun run check`** as the required static-analysis gate before merge.

## Import Organization

**Order:**
1. Framework / runtime (`vitest`, `dexie`, `@sveltejs/kit`, `$app/*`, `$lib/*` in app code).
2. Shared library modules via **`$lib/...`** alias (SvelteKit default for `src/lib/`).
3. Relative imports (`./stats`, `./client`) for same-feature siblings.

**Path aliases:**
- **`$lib`** → `src/lib/` (e.g. `import { db } from '$lib/db/client'`).
- **`$app/navigation`**, **`$app/paths`**, **`$app/state`** for SvelteKit client APIs in `.svelte` files.
- Generated **`./$types`** for load function types in `src/routes/**/+page.ts` and `+layout.ts`.

**Example (repo layer):**

```typescript
import { db } from '$lib/db/client';
import { RepoErrorCode, repoError } from '$lib/kit/repoErrors';
import { assertValidSemesterBounds, mergeSemesterFields } from '$lib/logic/semesterCalendar';
import type { ClassId, ClassRow } from '$lib/db/types';
```

**Barrel files:**
- `src/lib/index.ts` is a placeholder only — **import from concrete modules**, not from `$lib` root.

## Layering and Module Design

**Follow this stack; do not skip layers:**

| Layer | Path | Responsibility |
|-------|------|----------------|
| Routes (UI + load) | `src/routes/**` | Svelte UI, `load` with `depends()`, call `runMutation` for writes |
| Kit | `src/lib/kit/` | Load invalidation keys, `runMutation`, `repoErrors` |
| Logic | `src/lib/logic/` | Pure domain rules, stats, calendar, import parsers — **no Dexie** |
| Repos | `src/lib/repos/` | IndexedDB reads/writes, transactions, throw `repoError` |
| DB | `src/lib/db/` | Dexie schema (`client.ts`), `types.ts`, `withRetry.ts` |
| Stores | `src/lib/stores/` | UI-only state (e.g. toast) |

**Exports:**
- Export named functions/types from each module; avoid default exports except Svelte components and `svelte.config.js`.
- Keep **logic functions pure** — no `window`, `localStorage`, or `db` in `src/lib/logic/`.
- Keep **repos free of UI** — no toasts or `invalidate()` in `src/lib/repos/`.

## Error Handling

**Repository / domain errors:**
- Throw `repoError(RepoErrorCode.SOME_CODE)` from `src/lib/kit/repoErrors.ts` so `error.message` is a stable lookup key.
- Add user-facing copy to `REPO_ERROR_MESSAGES` in the same file (keyed by `Error.message`).
- For validation that is not a stable code, throw `new Error('Semester start must be on or before semester end.')` and register the exact message in `REPO_ERROR_MESSAGES`.

**UI mutations:**
- Wrap persisted writes in **`runMutation`** from `src/lib/kit/runMutation.ts` (uses `withRetry` by default).
- Pass `invalidate` load key(s), optional `successToast` / `errorToast`, and optional `mapError` override.
- Check result shape: `MutationResult<T>` is `{ ok: true, value }` | `{ ok: false }` — do not assume success after `await runMutation(...)`.

**Load functions:**
- Use `throw error(404, '...')` from `@sveltejs/kit` when entities are missing (`src/routes/class/[classId]/+layout.ts`).
- Call `depends(customLoadKey)` at the start of every `load` that should rerun on invalidation (`src/routes/+layout.ts`, `src/routes/class/[classId]/+page.ts`).

**Client-side validation before mutation:**
- Validate numeric inputs in the component and call `showToast('...')` directly for purely local mistakes (`src/routes/class/[classId]/+page.svelte` target fields).
- Do not duplicate repo validation in the UI except for immediate UX feedback.

**IndexedDB retries:**
- Use `withRetry` from `src/lib/db/withRetry.ts` inside `runMutation` (default) or call explicitly for transient failures.
- Do not retry `ConstraintError`, `DataError`, or `TypeError` (see `NON_RETRIABLE` in `withRetry.ts`).

## Logging

**Framework:** No logging library — **do not add `console.log` / `warn` / `error`** in `src/` (none present today).

**User feedback:**
- Use **`showToast`** from `src/lib/stores/toast.ts` for success and error messages surfaced to the user.
- Subscribe in layout via `$toastMessage` (`src/routes/+layout.svelte`).

## Comments

**When to comment:**
- File-level or export-level **JSDoc** on kit contracts and non-obvious domain rules (`src/lib/kit/loadKeys.ts`, `src/lib/kit/runMutation.ts`, `src/lib/kit/repoErrors.ts`).
- Short **section headers** in large policy modules (`// —— Display / form rules ——` in `src/lib/logic/sessionKindPolicy.ts`).
- Avoid restating what the code already says.

**JSDoc/TSDoc:**
- Use `{@link symbol}` when pointing to related helpers (`repoErrors.ts` → `repoErrorMessage`).
- Document load-key conventions and invalidation expectations in `loadKeys.ts`.

## Svelte / SvelteKit Conventions

**Svelte 5:**
- Use **`$props()`** for component inputs: `let { data }: { data: PageData } = $props();`
- Use **`$state`**, **`$derived`**, **`$derived.by`**, **`$effect`** for local UI state (`src/routes/class/[classId]/+page.svelte`).
- Use **`onclick`**, **`onchange`** (not `on:click`) on native elements.
- Use **`{#each items as item (item.id)}`** with a keyed block when lists can reorder.

**SSR / hosting:**
- Set `export const ssr = false` and `export const prerender = false` on the root layout load (`src/routes/+layout.ts`) — browser-only IndexedDB app.
- Use `adapter-static` with SPA fallback (`svelte.config.js`).

**Load invalidation:**
- Define keys in `src/lib/kit/loadKeys.ts` as `` `scope:segment:${id}` `` typed as `CustomLoadKey`.
- Invalidate the **narrowest** slice possible (`classLessonsLoadKey` vs `classScopeLoadKeys`).

**Svelte-specific suppressions:**
- When seeding `$state` from `data` props, use `// svelte-ignore state_referenced_locally` with a one-line justification (`src/routes/class/[classId]/+page.svelte`).

## Function Design

**Size:**
- Prefer small pure functions in `src/lib/logic/` (stats, calendar, session kind policy).
- Keep repos focused: one file per aggregate (`classes`, `lessons`, `students`, `attendance`).

**Parameters:**
- Pass **IDs** (`ClassId`, `LessonId`) rather than full rows when only identity is needed.
- Use a single **`patch` object** for partial updates: `updateClass(id, patch)`, `updateLesson(id, patch)`.

**Return values:**
- Repos **return created rows** from `create*` functions; `update*` / `delete*` return `Promise<void>`.
- Logic helpers return primitives, booleans, or plain objects — never Promises unless async I/O is required.

## Dates and IDs

**Dates:**
- Store lesson and semester dates as **`YYYY-MM-DD` strings** (ISO calendar dates), not `Date` objects in Dexie rows.
- Compare with `localeCompare` or helpers in `src/lib/logic/semesterCalendar.ts` (`compareIsoDate`).

**IDs:**
- Generate with **`crypto.randomUUID()`** for new rows.
- Compose deterministic absence IDs as `` `${lessonId}__${studentId}` `` (`src/lib/repos/attendance.repo.ts`).

## Preferences and browser APIs

**localStorage:**
- Access only through helpers in `src/lib/preferences/activeClass.ts` with `typeof localStorage === 'undefined'` guards for SSR safety.

**Prompts:**
- `window.prompt` / `window.confirm` are acceptable for simple class CRUD in `src/routes/+layout.svelte` — match existing UX when adding similar flows.

---

*Convention analysis: 2026-05-15*
