# Codebase Concerns

**Analysis Date:** 2026-05-15

## Tech Debt

**Monolithic route components (UI + persistence + stats in one file):**
- Issue: Class schedule, semester map, students, and lesson detail pages each embed Dexie calls, validation, derived contract stats, and large scoped CSS in single `.svelte` files instead of shared components or a thin “actions” layer.
- Files: `src/routes/class/[classId]/+page.svelte` (~488 lines), `src/routes/class/[classId]/SemesterMap.svelte` (~303 lines), `src/routes/class/[classId]/students/+page.svelte` (~259 lines), `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte` (~272 lines), `src/routes/+layout.svelte` (~167 lines)
- Impact: Harder to test UI flows, higher merge conflict risk, and duplicated patterns (toast + `withRetry` + `invalidate`) across routes.
- Fix approach: Extract presentational components (stats panel, lesson table, roster list) and small route-local helpers; keep repos/logic pure and covered by existing unit tests.

**Non-transactional student append:**
- Issue: `appendStudents` performs one `db.students.add` per name with no Dexie transaction, unlike `replaceStudents` and cascade deletes.
- Files: `src/lib/repos/students.repo.ts`
- Impact: A mid-loop failure can leave a partial import with no rollback.
- Fix approach: Wrap the loop in `db.transaction('rw', db.students, async () => { ... })`, mirroring `replaceStudents`.

**Silent no-op on missing lesson update:**
- Issue: `updateLesson` returns early when the lesson row is missing instead of throwing, so callers cannot distinguish “saved” from “nothing to update.”
- Files: `src/lib/repos/lessons.repo.ts`
- Impact: Stale UI or race after delete may appear to succeed until the next `invalidate`.
- Fix approach: Throw a dedicated error (e.g. `LESSON_NOT_FOUND`) and handle it in route handlers with toast + revalidate.

**Generic error swallowing in UI:**
- Issue: Most `try/catch` blocks in routes only call `showToast('Could not …')` without logging error type, Dexie failure, or validation message (except session-kind and semester paths).
- Files: `src/routes/+layout.svelte`, `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/students/+page.svelte`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`
- Impact: Production debugging and distinguishing user error vs storage failure is difficult.
- Fix approach: Centralize `handleRepoError(e, fallbackMessage)` that maps known `Error.message` values and optionally logs unknown errors in dev.

**Blocking browser dialogs for core CRUD:**
- Issue: Class create/rename and destructive actions use `window.prompt` / `window.confirm` instead of in-app modals.
- Files: `src/routes/+layout.svelte`, `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/students/+page.svelte`
- Impact: Poor mobile UX, no styling, and harder automated testing.
- Fix approach: Replace with accessible Svelte dialog components; keep confirm copy aligned with cascade behavior in repos.

**Unused npm dependency:**
- Issue: `@sveltejs/adapter-auto` is listed in `package.json` devDependencies but `svelte.config.js` uses `@sveltejs/adapter-static` only.
- Files: `package.json`, `svelte.config.js`
- Impact: Confusing deploy docs and extra install surface.
- Fix approach: Remove `adapter-auto` or document why both are kept.

**No ESLint / Prettier project config:**
- Issue: Repository relies on `svelte-check` only; no shared lint or format config at repo root.
- Files: `package.json` (scripts `check`, `test` only)
- Impact: Style drift across large Svelte files; no automated import/order or a11y rules.
- Fix approach: Add `eslint` + `eslint-plugin-svelte` and optional Prettier aligned with Svelte 5 conventions.

## Known Bugs

**Lesson detail blur-save can desync UI from IndexedDB:**
- Symptoms: User edits date/hours/title on the lesson page; `onblur` calls `persistLessonMeta`, which updates local `$state` bindings but does not `invalidate` on success. If the write fails, the form still shows edited values while Dexie retains the previous row.
- Files: `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte` (`persistLessonMeta`, `onblur` handlers)
- Trigger: IndexedDB error or rejected `updateLesson` after blur.
- Workaround: Navigate away and back, or change session kind (which revalidates on success).

**CSV roster import mishandles quoted commas:**
- Symptoms: Names or fields containing commas inside quotes may be parsed incorrectly because only the substring before the first comma is used.
- Files: `src/lib/logic/rosterImport.ts` (`firstCell`)
- Trigger: Import a `.csv` where the name column includes `", "` or standard CSV escaping.
- Workaround: Use `.txt` one-name-per-line import.

**Import treats any non-`.csv` extension as plain text:**
- Symptoms: A misnamed file (e.g. `.tsv`, `.xlsx` renamed) is read as line-based text; parsing may produce garbage names without a hard error.
- Files: `src/routes/class/[classId]/students/+page.svelte` (`onFile`, `fileKind` logic)
- Trigger: User selects a non-CSV, non-TXT file.
- Workaround: Use `.csv` or `.txt` only; verify preview before append/replace.

## Security Considerations

**Local-only data with no access control:**
- Risk: All class, student, and attendance data live in the user’s browser IndexedDB (`lesson-planner-db`); anyone with device or profile access can read or tamper with data via devtools. There is no auth layer by design.
- Files: `src/lib/db/client.ts`, all `src/lib/repos/*.ts`, `src/routes/+layout.ts` (`ssr = false`)
- Current mitigation: Static SPA, no server, no secrets in repo (no `.env` files detected).
- Recommendations: Document threat model in README; if deployed on shared machines, warn users; do not add secrets to the client bundle.

**Unbounded client-side file read on import:**
- Risk: `FileReader.readAsText` loads the entire selected file into memory with no size cap; a very large upload could freeze or crash the tab.
- Files: `src/routes/class/[classId]/students/+page.svelte`
- Current mitigation: Teacher-controlled local files only; preview before commit.
- Recommendations: Enforce max file size (e.g. 1–2 MB) and row count before parse; show explicit error in UI.

**Student roster data in browser storage:**
- Risk: Student names are PII stored unencrypted in IndexedDB; clearing site data or browser uninstall loses records with no recovery path.
- Files: `src/lib/db/client.ts`, `src/lib/repos/students.repo.ts`
- Current mitigation: Confirmed destructive replace with `window.confirm`.
- Recommendations: Optional export/backup (called out as v1 non-goal in `docs/superpowers/specs/2026-04-20-lesson-planner-design.md`); warn in UI about data loss on “clear site data.”

## Performance Bottlenecks

**Full lesson list reload per class invalidation:**
- Problem: Class schedule load always fetches all lessons for the class; every `invalidate(classLoadKey)` re-runs `listLessons` and re-renders large tables and `SemesterMap` month grids.
- Files: `src/routes/class/[classId]/+page.ts`, `src/lib/repos/lessons.repo.ts`, `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/SemesterMap.svelte`
- Cause: No pagination or incremental queries; semester map builds multiple 6×7 grids from full `lessons` array.
- Improvement path: Debounce target saves; invalidate only affected slices where possible; memoize month grids per `yearMonth` if classes grow large (hundreds of sessions).

**Semester map renders all months in range at once:**
- Problem: For a long semester, `listYearMonthsInRange` drives many month grids (42 cells each) in one DOM subtree.
- Files: `src/lib/logic/semesterCalendar.ts`, `src/routes/class/[classId]/SemesterMap.svelte`
- Cause: Eager rendering of every month between start and end.
- Improvement path: Virtualize months or collapse to a single scrollable strip with lazy mount.

## Fragile Areas

**Contract stats and session-kind rules:**
- Files: `src/lib/logic/stats.ts`, `src/lib/logic/sessionKindUi.ts`, `src/routes/class/[classId]/+page.svelte`, `src/lib/repos/lessons.repo.ts`
- Why fragile: Teacher/student hour conversion constants (`60` / `50` minutes), flex-pool formulas, and session-kind transitions (e.g. blocking `class` → `extra` when absences exist) must stay consistent across UI, repo, and tests.
- Safe modification: Change `stats.ts` and extend `src/lib/logic/stats.test.ts` first; run full `bun run test`; update `lessons.repo.test.ts` for new session-kind rules.
- Test coverage: Strong unit coverage on stats and lesson repo; no UI/integration tests for the overview stats panel.

**Dexie schema migrations:**
- Files: `src/lib/db/client.ts` (versions 1–3 with `.upgrade` hooks)
- Why fragile: New indexes or field defaults require a new `version(n)` block; mistakes can brick existing user DBs in the wild.
- Safe modification: Add versioned upgrade with backfill tests using `fake-indexeddb` (see `src/test/setup.ts`); smoke-test open/migrate in `src/lib/db/client.smoke.test.ts`.
- Test coverage: Smoke test only; no automated test per migration path.

**Attendance optimistic UI:**
- Files: `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte` (`toggleAbsent` updates `Set` then writes; revalidates only on failure)
- Why fragile: Optimistic absent set can disagree with DB until failure path runs.
- Safe modification: Keep optimistic UX but revalidate on success for long-term consistency, or revert set on catch (partially done on error).

**Class switcher when `routeClassId` is empty:**
- Files: `src/routes/+layout.svelte` (`<select value={routeClassId}>` on home redirect route)
- Why fragile: On `/` before redirect, `routeClassId` may be empty while options exist; behavior depends on browser select handling.
- Safe modification: Hide switcher until `routeClassId` is set or bind to first class id explicitly.

## Scaling Limits

**IndexedDB single-database, client-only:**
- Current capacity: Suitable for typical class sizes (tens of students, tens to low hundreds of lessons per class); Dexie handles thousands of rows on modern browsers.
- Limit: No sync across devices; one browser profile = one dataset; private mode may restrict persistence.
- Scaling path: Export/import JSON backup, optional cloud sync (explicit v1 non-goal in design spec).

**No CI pipeline in repository:**
- Current capacity: Tests run locally via `bun run test`; no `.github/workflows` detected.
- Limit: Regressions can land without automated check on PRs.
- Scaling path: Add GitHub Actions running `bun run check` and `bun run test` on push/PR.

## Dependencies at Risk

**SvelteKit + Vite major versions:**
- Risk: Project pins current majors (`@sveltejs/kit` ^2.57, `vite` ^8.0.7, `svelte` ^5.55); Svelte 5 runes and Kit 2 load APIs are still evolving.
- Impact: Upgrades may require runes/`$effect` pattern updates across route components.
- Migration plan: Run `bun run check` after any Kit/Svelte bump; add component tests before large upgrades.

**Dexie 4.x as sole persistence:**
- Risk: All application state depends on Dexie schema and browser IndexedDB availability; Safari private mode and corporate policies can block or clear storage.
- Impact: Total data loss from user or IT policy; no server recovery.
- Migration plan: Optional export format documented in a future phase; keep migration hooks versioned in `client.ts`.

## Missing Critical Features

**Export / import backup (documented non-goal for v1):**
- Problem: No way to backup or restore Dexie data except manual devtools; device loss or “clear site data” is irreversible.
- Blocks: Multi-device use, disaster recovery, migration to another browser.
- Reference: `docs/superpowers/specs/2026-04-20-lesson-planner-design.md` (Non-goals: no full export/import backup).

**Cloud sync and accounts:**
- Problem: By design, no backend; teachers cannot share rosters across machines without manual file import of names only (not full class/lesson state).
- Blocks: Team or substitute-teacher workflows.

**Recurring lesson templates:**
- Problem: Every session date is manual entry; no weekly pattern generator.
- Blocks: Faster semester setup for fixed timetables (also listed as non-goal in design spec).

## Test Coverage Gaps

**No tests for attendance repository:**
- What's not tested: `listAbsentStudentIds`, `setAbsent`, composite absence id format.
- Files: `src/lib/repos/attendance.repo.ts`
- Risk: Absence key or query regressions break lesson attendance silently.
- Priority: Medium

**No tests for students repository (except via class cascade):**
- What's not tested: `addStudent`, `updateStudent`, `appendStudents`, `replaceStudents` isolation and ordering.
- Files: `src/lib/repos/students.repo.ts`
- Risk: Partial import or cascade bugs on roster replace.
- Priority: Medium

**No Svelte component or route tests:**
- What's not tested: Load functions wiring, navigation, semester map rendering, file import UI, toast flows.
- Files: `src/routes/**`, `src/routes/class/[classId]/SemesterMap.svelte`
- Risk: UI regressions in contract stats display and import preview only caught manually.
- Priority: High for critical teacher workflows (import replace, delete class)

**Vitest excludes Svelte test files:**
- What's not tested: Any `*.svelte.test.ts` would be excluded by config.
- Files: `vite.config.ts` (`exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']`)
- Risk: Component testing strategy not enabled without config change.
- Priority: Low until component tests are added

**Limited migration coverage:**
- What's not tested: Dexie v1→v2→v3 upgrade paths with pre-migration fixture data.
- Files: `src/lib/db/client.ts`
- Risk: Existing users upgrading from older builds may hit corrupt or partial defaults.
- Priority: Medium

---

*Concerns audit: 2026-05-15*
