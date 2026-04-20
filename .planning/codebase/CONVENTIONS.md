# Coding Conventions

**Analysis Date:** 2026-04-20

## Naming Patterns

**Files:**
- Use **kebab-case** for route segments and assets (for example `src/routes/class/[classId]/+page.svelte`, `src/lib/assets/favicon.svg`).
- Place **SvelteKit route files** as `+page.svelte`, `+layout.svelte` under `src/routes/`.
- Use **dot-suffix roles** for modules: `*.repo.ts` for Dexie-backed data access (`src/lib/repos/classes.repo.ts`), `*.ts` for pure logic (`src/lib/logic/stats.ts`, `src/lib/logic/rosterImport.ts`).
- Colocate **unit tests** as `*.test.ts` next to the module under test (for example `src/lib/logic/stats.test.ts`).

**Functions:**
- Use **camelCase** for functions and variables (`listClasses`, `createClass`, `showToast`, `withRetry`).
- Prefix **async data helpers** with verbs that describe the operation: `list*`, `get*`, `create*`, `update*`, `delete*`.

**Variables:**
- Use **camelCase** (`lessons`, `targetHours`, `routeClassId`).
- Use **boolean-ish names** where clarity helps (`empty`, `loading`, `done` on rows).

**Types:**
- Suffix **database row shapes** with `Row` and **opaque IDs** with `Id` in `src/lib/db/types.ts` (`ClassRow`, `ClassId`, `LessonRow`).
- Export **narrow types** for logic inputs (`LessonForStats` in `src/lib/logic/stats.ts`).
- Export **result shapes** for parsers (`ImportNamesResult` in `src/lib/logic/rosterImport.ts`).

## Code Style

**Formatting:**
- **Not detected:** no committed `.prettierrc`, `prettier.config.*`, or `biome.json`. Source uses **tab indentation** and typical Svelte/TS formatting (see `src/routes/class/[classId]/+page.svelte`, `package.json`).

**Linting:**
- **Not detected:** no `eslint.config.*` or `.eslintrc*`.
- **Typecheck:** use SvelteKit + TypeScript strict mode via `npm run check` / `svelte-check` (see `package.json`, `tsconfig.json` with `"strict": true`).

## Import Organization

**Order (prescriptive pattern observed in `src/routes/+layout.svelte` and `src/routes/class/[classId]/+page.svelte`):**
1. **SvelteKit / Vite** modules (`$app/environment`, `$app/navigation`, `$app/state`).
2. **`svelte`** runtime (`onMount`, and runes are used in-script without importing runes).
3. **`$lib/...`** application code (repos, stores, logic, types).
4. **Relative** imports for colocated types only when required (for example `./$types` for `PageData` in `src/routes/class/[classId]/+page.svelte`).

**Path Aliases:**
- Prefer **`$lib/...`** for all shared code under `src/lib/` (for example `import { db } from '$lib/db/client'` in `src/lib/repos/classes.repo.test.ts`).
- **`$app/*`** aliases come from SvelteKit; do not reconfigure them in `tsconfig.json` (comment in `tsconfig.json` defers aliases to SvelteKit config).

## Error Handling

**Patterns:**
- **IndexedDB / Dexie:** wrap mutating calls that may race or flake with `withRetry` from `src/lib/db/withRetry.ts` before surfacing errors to the UI (see usage in `src/routes/+layout.svelte` and `src/routes/class/[classId]/+page.svelte`).
- **User-facing failures:** use `try` / `catch` with an **empty `catch` block** and call `showToast` from `src/lib/stores/toast.ts` with a short message (no `console.error` in catch paths in current UI code).
- **Retry policy:** `withRetry` rethrows the last error after retries; it **does not retry** errors whose `name` is in `ConstraintError`, `DataError`, or `TypeError` (`src/lib/db/withRetry.ts`).

## Logging

**Framework:** **Not detected** — no shared logger; `src/` contains **no** `console.log` / `console.warn` / `console.error` usages at analysis time.

**Patterns:**
- Prefer **toasts** for operator-visible issues (`showToast` in `src/lib/stores/toast.ts`).
- Do **not** introduce `console.*` for routine UX errors unless debugging locally; align with existing toast-only user feedback.

## Comments

**When to Comment:**
- Sparse inline comments; prefer **clear names** and small functions (see `src/lib/logic/rosterImport.ts`).
- Use **file-level or block comments** only when behavior is non-obvious (for example JSDoc-style block on `svelte.config.js` export).

**JSDoc/TSDoc:**
- **Minimal** — types carry most documentation (`src/lib/db/types.ts`, exported function signatures).

## Function Design

**Size:** Keep route script sections focused; heavy logic belongs in `src/lib/logic/` or `src/lib/repos/`.

**Parameters:**
- Pass **explicit objects** for creates/updates (`createClass({ name, totalHoursTarget })` in `src/lib/repos/classes.repo.ts`).
- Use **`Partial<Pick<...>>`** for patches (`updateClass` in `src/lib/repos/classes.repo.ts`).

**Return Values:**
- Repos return **domain rows** or `Promise<void>` for mutations (`ClassRow`, `Promise<ClassRow | undefined>` patterns in `src/lib/repos/classes.repo.ts`).

## Module Design

**Exports:** Prefer **named exports** for utilities and repos (`export async function listClasses`, `export function sumScheduledHours`).

**Barrel Files:** **Not used** — import from concrete modules (`$lib/repos/classes.repo`, `$lib/db/client`) rather than a single `index.ts` barrel under `src/lib/`.

## Svelte 5 UI Conventions

**Runes (prescriptive):**
- Use **`$state`** for mutable local UI state, **`$derived` / `$derived.by`** for computed values, **`$effect`** for synchronizing props into state where needed, **`$props()`** for component props (see `src/routes/class/[classId]/+page.svelte`, `src/routes/+layout.svelte`).

**Browser-only I/O:**
- Guard with `browser` from `$app/environment` before `window` or client-only navigation (`src/routes/+page.svelte`, `src/routes/+layout.svelte`).

**Stores:**
- Use **`writable`** from `svelte/store` for cross-cutting UI like toasts (`src/lib/stores/toast.ts`).

---

*Convention analysis: 2026-04-20*
