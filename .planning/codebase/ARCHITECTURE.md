# Architecture

**Analysis Date:** 2026-04-20

## Pattern Overview

**Overall:** Single-page application (SPA) built on SvelteKit with a static adapter, client-only rendering, and IndexedDB persistence via Dexie.

**Key Characteristics:**
- No server-side rendering: root `src/routes/+layout.ts` sets `ssr = false` and `prerender = false`, so routing and loads run in the browser context appropriate for Dexie.
- Static deployment: `svelte.config.js` uses `@sveltejs/adapter-static` with `fallback: 'index.html'` for client-side history fallback.
- Thin route modules call into repository modules; pure domain helpers live under `src/lib/logic/`.

## Layers

**Presentation (routes and Svelte UI):**
- Purpose: URL structure, layouts, forms, navigation, and user feedback.
- Location: `src/routes/`
- Contains: `+page.svelte`, `+layout.svelte`, and selective `+layout.ts` / `+page.ts` loaders.
- Depends on: `$lib/repos/*`, `$lib/logic/*`, `$lib/stores/toast`, `$lib/preferences/activeClass`, `$app/navigation`, `$app/state`, `$app/environment`.
- Used by: End users in the browser only (SPA).

**Application / orchestration (per-page logic):**
- Purpose: Bind UI state (`$state`, `$derived`, `$effect`) to async repo calls, validation, and navigation.
- Location: Inline in route Svelte files (for example `src/routes/+layout.svelte`, `src/routes/class/[classId]/+page.svelte`).
- Contains: Event handlers, `onMount` refresh patterns, optimistic or post-action list refresh.
- Depends on: Repositories, `withRetry`, toast helpers.
- Used by: Route components.

**Data access (repositories):**
- Purpose: Encapsulate Dexie table access, sorting, UUID creation, and transactional cascades.
- Location: `src/lib/repos/`
- Contains: `classes.repo.ts`, `students.repo.ts`, `lessons.repo.ts`, `attendance.repo.ts` — each exports async functions (no classes).
- Depends on: `db` from `src/lib/db/client.ts`, row types from `src/lib/db/types.ts`.
- Used by: Load functions and route components.

**Persistence (IndexedDB schema):**
- Purpose: Define database name, version, stores, and indexes.
- Location: `src/lib/db/client.ts` (`LessonPlannerDB`, exported `db` singleton).
- Contains: Dexie subclass wiring tables `classes`, `students`, `lessons`, `absences`.
- Depends on: `src/lib/db/types.ts` for row shapes.
- Used by: All repository modules.

**Domain logic (pure functions):**
- Purpose: Deterministic calculations and parsing with no I/O.
- Location: `src/lib/logic/stats.ts`, `src/lib/logic/rosterImport.ts`
- Contains: Hour totals, completion counts, CSV/TXT name parsing.
- Depends on: Nothing from `db` or routes.
- Used by: Schedule page and students import UI.

**Cross-cutting utilities:**
- Purpose: Retry transient storage errors; global toast message; remember last class in `localStorage`.
- Location: `src/lib/db/withRetry.ts`, `src/lib/stores/toast.ts`, `src/lib/preferences/activeClass.ts`
- Depends on: Svelte `writable` for toast; browser APIs guarded where relevant.
- Used by: Repos consumers across routes.

## Data Flow

**Bootstrap and class selection:**

1. User opens `/`; `src/routes/+page.svelte` runs `onMount`, calls `listClasses()` from `classes.repo`, reads `getLastClassId()` from `activeClass`, then `goto` to `/class/{id}` or shows empty state.
2. Root `src/routes/+layout.svelte` loads the class list in `onMount` for the header switcher and CRUD actions.

**Class-scoped navigation:**

1. `src/routes/class/[classId]/+layout.ts` `load` calls `getClass(params.classId)`; missing class throws `error(404)` from `@sveltejs/kit`.
2. `src/routes/class/[classId]/+layout.svelte` receives `data.class`, writes `classId` to `localStorage` via `setLastClassId` in an `$effect`, and renders sub-nav for Schedule vs Students.

**Schedule (lessons list):**

1. `src/routes/class/[classId]/+page.svelte` uses layout `data.class` for identity and targets; `onMount` calls `listLessons` to populate local `$state`.
2. Mutations (`createLesson`, `updateLesson`, `deleteLessonCascade`, `updateClass` for hour target) go through repos, typically wrapped in `withRetry`, then `refresh()` reloads lessons from IndexedDB.
3. Derived stats use `src/lib/logic/stats.ts` over the in-memory lesson list.

**Lesson detail and attendance:**

1. `src/routes/class/[classId]/lesson/[lessonId]/+page.ts` `load` fetches `getLesson` and validates `lesson.classId === params.classId` or 404.
2. `+page.svelte` seeds form fields from `data.lesson` when `lesson.id` changes; `onMount` loads students and absence IDs.
3. Attendance toggles call `setAbsent` in `attendance.repo.ts`; lesson meta persists on blur via `updateLesson`.

**Students and roster import:**

1. `src/routes/class/[classId]/students/+page.svelte` uses layout `data.class`; `onMount` loads `listStudents`.
2. File import uses `parseCsvNames` / `parseTxtNames` from `rosterImport.ts`, then `appendStudents` or `replaceStudents` in a transaction.

**State Management:**
- **Server/load data:** SvelteKit `load` returns serializable props (`class`, `lesson`) consumed as `data` in `$props()`.
- **Client lists and forms:** Svelte 5 `$state` and `$derived` in page components; lists refreshed after mutations by re-querying repos.
- **Global UI:** `toastMessage` writable in `src/lib/stores/toast.ts`; root layout subscribes with `$toastMessage`.
- **Persistence preference:** Last visited class id in `localStorage` via `src/lib/preferences/activeClass.ts`.

## Key Abstractions

**Dexie database singleton:**
- Purpose: Single IndexedDB connection and schema for the app.
- Examples: `src/lib/db/client.ts`
- Pattern: Subclass `Dexie`, define `version(1).stores({...})`, export `const db = new LessonPlannerDB()`.

**Row types:**
- Purpose: Typed records for each table (`ClassRow`, `StudentRow`, `LessonRow`, `AbsenceRow`) and branded id aliases.
- Examples: `src/lib/db/types.ts`
- Pattern: Plain TypeScript types; ids are `string` with semantic aliases (`ClassId`, etc.).

**Repository functions:**
- Purpose: Stable API for CRUD and cascade deletes; hide Dexie query details.
- Examples: `src/lib/repos/classes.repo.ts`, `src/lib/repos/lessons.repo.ts`, `src/lib/repos/students.repo.ts`, `src/lib/repos/attendance.repo.ts`
- Pattern: Named exports, `async` functions, `db.transaction` for multi-table consistency (`deleteClassCascade`, `replaceStudents`, etc.).

**Retry wrapper:**
- Purpose: Retry once (configurable) on failures except non-retriable `Error` names.
- Examples: `src/lib/db/withRetry.ts`
- Pattern: Higher-order async helper used around repo calls in UI handlers.

**Pure logic modules:**
- Purpose: Testable functions without storage or framework coupling.
- Examples: `src/lib/logic/stats.ts`, `src/lib/logic/rosterImport.ts`
- Pattern: Exported functions and small result types (`ImportNamesResult`).

## Entry Points

**Build and dev server:**
- Location: `vite.config.ts`
- Triggers: `vite dev`, `vite build`, `vite preview` (via `package.json` scripts).
- Responsibilities: SvelteKit plugin, Vitest project config for Node environment tests.

**SvelteKit configuration:**
- Location: `svelte.config.js`
- Triggers: `svelte-kit sync`, build pipeline.
- Responsibilities: `vitePreprocess`, static adapter and SPA fallback.

**HTML shell:**
- Location: `src/app.html`
- Triggers: SvelteKit injects `%sveltekit.head%` and `%sveltekit.body%`.
- Responsibilities: Document template, default `data-sveltekit-preload-data="hover"`.

**Application root route:**
- Location: `src/routes/+layout.ts`, `src/routes/+layout.svelte`
- Triggers: Every navigation.
- Responsibilities: Disable SSR/prerender globally; app chrome, class switcher, toast region, `{@render children()}`.

**Type augmentation hook:**
- Location: `src/app.d.ts`
- Triggers: TypeScript check.
- Responsibilities: `App` namespace placeholders for Kit types (currently empty extensions).

## Error Handling

**Strategy:** Combine SvelteKit `error()` for missing entities in loaders, try/catch around async mutations in components with user-visible toasts.

**Patterns:**
- Loaders: `throw error(404, ...)` when `getClass` or `getLesson` fails validation — see `src/routes/class/[classId]/+layout.ts`, `src/routes/class/[classId]/lesson/[lessonId]/+page.ts`.
- Mutations: `try { await withRetry(() => repoFn(...)) } catch { showToast('...') }` across route components.
- `withRetry`: Re-throws last error after retries exhausted or on non-retriable error names — `src/lib/db/withRetry.ts`.

## Cross-Cutting Concerns

**Logging:** No structured logging framework; errors surface via toast strings only.

**Validation:** Input checks in components (finite numbers, non-empty dates/names) before calling repos; database constraints rely on Dexie and application logic.

**Authentication:** Not applicable — local-first app with no auth layer in code.

---

*Architecture analysis: 2026-04-20*
