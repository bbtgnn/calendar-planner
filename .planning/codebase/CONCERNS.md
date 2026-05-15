# Codebase Concerns

**Analysis Date:** 2026-05-15

## Tech Debt

**Browser-native dialogs for destructive and create flows:**
- Issue: Class create/rename/delete and roster/lesson deletes use `window.prompt` and `window.confirm` instead of in-app UI. Poor accessibility, no styling, blocks the main thread, and is awkward on mobile.
- Files: `src/routes/+layout.svelte`, `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/students/+page.svelte`
- Impact: Inconsistent UX; harder to add validation previews or undo.
- Fix approach: Add a small shared confirm/dialog component (the implementation plan mentions `src/lib/ui/ConfirmDialog.svelte` but it was never added) and replace native dialogs.

**Duplicated page styling (no shared UI layer):**
- Issue: Each route duplicates `.card`, `.btn`, table, and form styles in scoped `<style>` blocks. The plan referenced `src/lib/ui/` components that do not exist.
- Files: `src/routes/class/[classId]/+page.svelte` (~481 lines), `src/routes/class/[classId]/students/+page.svelte`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`, `src/routes/class/[classId]/SemesterMap.svelte`, `src/routes/+layout.svelte`
- Impact: Visual drift and large diffs when changing design tokens.
- Fix approach: Extract shared layout primitives under `src/lib/ui/` or a single `app.css` with utility classes.

**Legacy stats alias kept alongside kind-aware API:**
- Issue: `sumScheduledHours` duplicates `sumScheduledTeacherHours` behavior (both sum all `durationHours`). Docs/plans still reference the older name.
- Files: `src/lib/logic/stats.ts`, `src/lib/logic/stats.test.ts`, `docs/superpowers/plans/2026-04-20-lesson-planner.md`
- Impact: Confusing API for future stats work; risk of calling the wrong helper when adding kind filters.
- Fix approach: Deprecate `sumScheduledHours` with a thin alias comment, or remove after grep-driven migration.

**Unused npm dependency:**
- Issue: `@sveltejs/adapter-auto` is listed in `package.json` devDependencies but `svelte.config.js` uses `@sveltejs/adapter-static` only.
- Files: `package.json`, `svelte.config.js`
- Impact: Install bloat and confusion about deployment target.
- Fix approach: Remove `@sveltejs/adapter-auto` from `package.json`.

**No formatter/linter toolchain:**
- Issue: No ESLint, Prettier, or Biome config in the repo. Quality relies on `svelte-check` and Vitest only.
- Files: repo root (absence of `eslint.config.*`, `.prettierrc*`)
- Impact: Inconsistent style across contributors; some issues only caught at review time.
- Fix approach: Add ESLint (Svelte plugin) + Prettier or Biome aligned with SvelteKit defaults.

## Known Bugs

**`updateLesson` no-ops when lesson id is missing:**
- Symptoms: `updateLesson` returns successfully without throwing or updating if the lesson row does not exist.
- Files: `src/lib/repos/lessons.repo.ts` (early `return` when `!current`)
- Trigger: Stale bookmark to deleted lesson, race after delete, or bad id.
- Workaround: Lesson route load throws 404 via `getLesson` in `src/routes/class/[classId]/lesson/[lessonId]/+page.ts`; inline edits on the class list could still call `updateLesson` with a stale id until invalidation completes.

**`appendStudents` is not transactional:**
- Symptoms: If one `db.students.add` fails mid-loop, earlier names may persist without a full rollback.
- Files: `src/lib/repos/students.repo.ts` (`appendStudents`)
- Trigger: Large import or IndexedDB errors during bulk append.
- Workaround: Use `replaceStudents` (wrapped in `db.transaction`) when atomicity matters; prefer smaller batches.

## Security Considerations

**All data is local and unauthenticated (by design):**
- Risk: Any script running in the origin (XSS, malicious extension) can read/write IndexedDB and `localStorage`. There is no server-side access control.
- Files: `src/lib/db/client.ts`, `src/lib/preferences/activeClass.ts`, all `src/lib/repos/*.ts`
- Current mitigation: Static SPA, no network API, no user-generated HTML rendering (`{@html}` not used in app routes).
- Recommendations: Keep avoiding `{@html}`; if adding rich text later, sanitize. Do not add third-party scripts without CSP review.

**Roster import reads arbitrary user files in-browser:**
- Risk: Very large files can block the main thread during `FileReader` + parse; no size cap.
- Files: `src/routes/class/[classId]/students/+page.svelte`, `src/lib/logic/rosterImport.ts`
- Current mitigation: Parsing is synchronous but local-only (no upload).
- Recommendations: Cap file size (e.g. 1 MB), stream or chunk parsing for large rosters.

**No secrets in repo (good):**
- `.env` not required for runtime; app has no backend credentials surface.

## Performance Bottlenecks

**Semester map renders full month grids in the DOM:**
- Problem: For each `YYYY-MM` in range, `monthGridMondayFirst` emits 42 cells; a multi-year semester creates hundreds of DOM nodes and re-renders on every lesson change via `uniqueKindsByDate`.
- Files: `src/routes/class/[classId]/SemesterMap.svelte`, `src/lib/logic/semesterCalendar.ts`
- Cause: Eager horizontal strip of all months; `{@const}` and nested `{#each}` per cell.
- Improvement path: Virtualize months, collapse off-screen months, or render a single month with navigation for long ranges.

**Lesson list loaded entirely per class:**
- Problem: `listLessons` loads all lessons for a class into memory and sorts in JS; no pagination.
- Files: `src/lib/repos/lessons.repo.ts`, `src/routes/class/[classId]/+page.ts`
- Cause: Dexie query + in-memory `sort`; no composite index for `classId+date` (plan mentioned it; schema uses separate indexes only in `src/lib/db/client.ts`).
- Improvement path: Add Dexie compound index `[classId+date]` if filtering grows; paginate UI for classes with many sessions.

**IndexedDB retry is minimal:**
- Problem: `withRetry` defaults to a single retry (`retries ?? 1` → 2 attempts total). Transient IDB contention may still fail.
- Files: `src/lib/db/withRetry.ts`, `src/lib/kit/runMutation.ts`
- Cause: Conservative retry to avoid duplicate writes without idempotency keys.
- Improvement path: Classify retriable Dexie errors explicitly; use transactions + idempotent keys where needed.

## Fragile Areas

**UTC calendar math vs local date inputs:**
- Files: `src/lib/logic/semesterCalendar.ts` (`toUtcIsoCalendarDate`, `monthGridMondayFirst`), `src/routes/class/[classId]/SemesterMap.svelte` (`todayUtcIso`), date `<input type="date">` in routes
- Why fragile: “Today” highlighting uses UTC ISO dates while `<input type="date">` values follow the user’s local calendar. Near timezone boundaries, today on the map may not match the teacher’s local date.
- Safe modification: Add tests with fixed `Date` mocks for TZ edges; document that stored lesson dates are plain `YYYY-MM-DD` strings without TZ.
- Test coverage: `src/lib/logic/semesterCalendar.test.ts` covers grid math but not TZ boundary cases against UI.

**Session kind + attendance coupling:**
- Files: `src/lib/logic/sessionKindPolicy.ts`, `src/lib/repos/lessons.repo.ts`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`
- Why fragile: Rules span UI disables, repo throws (`SESSION_KIND_EXTRA_BLOCKED_ABSENCES`), and absence clearing on kind change. Easy to break one layer without updating others.
- Safe modification: Change policy only in `sessionKindPolicy.ts` and extend `src/lib/logic/sessionKindPolicy.test.ts` + `src/lib/repos/lessons.repo.test.ts` together.
- Test coverage: Good for repo/policy; no Svelte component tests.

**Dexie schema migrations:**
- Files: `src/lib/db/client.ts` (versions 1–3 with `.upgrade` hooks)
- Why fragile: Future schema changes must keep upgrade paths idempotent; mixed client versions are not a concern (local only), but a bad upgrade can brick local data.
- Safe modification: Add migration tests that seed v1-shaped data and open DB; bump version with explicit upgrade steps only.
- Test coverage: `src/lib/db/client.smoke.test.ts` only checks basic put/get, not upgrades.

**Optimistic attendance UI without success invalidation:**
- Files: `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte` (`toggleAbsent` updates local `Set` then persists; invalidates `lessonKey` only on error)
- Why fragile: Assumes server state equals optimistic state; second tab or external DB edit could desync until manual refresh.
- Safe modification: Invalidate `lessonLoadKey` on success as well, or reload absent ids after `runMutation` succeeds.

## Scaling Limits

**IndexedDB per-origin storage:**
- Current capacity: Browser-dependent (often hundreds of MB to GB); all classes, students, lessons, and absences for one teacher.
- Limit: Private browsing modes may reject or clear storage; `QuotaExceededError` is not handled at app startup.
- Scaling path: Catch open/write failures in layout load and show a blocking error UI; optional export/import JSON for backup.

**Single-device, single-user model:**
- Current capacity: One teacher’s data per browser profile.
- Limit: No sync across devices; clearing site data loses everything.
- Scaling path: Optional export/import or future sync layer (out of scope today).

## Dependencies at Risk

**No automated dependency or CI updates:**
- Risk: `package.json` pins ranges (`^`) without lockfile discipline visible in analysis; no GitHub Actions workflow detected.
- Impact: Regressions from Dexie/SvelteKit majors may land unnoticed until manual `bun run test`.
- Migration plan: Add CI running `bun run test` and `bun run check`; consider committing `bun.lock` if not already standard for the team.

## Missing Critical Features

**Data backup and restore:**
- Problem: No export/import of Dexie data; README states data stays in IndexedDB only (`README.md`).
- Blocks: Recovery after browser data wipe, migration to a new machine, or audit archival.

**Production CI and deployment docs:**
- Problem: No `.github/workflows` for test/check on PRs; deployment is manual static hosting per README (`bun run build` → `build/`).
- Blocks: Team confidence on merges without local discipline.

**In-app class/lesson editing beyond prompts:**
- Problem: Creating a class always uses `totalHoursTarget: 40` from `window.prompt` flow only (`src/routes/+layout.svelte`).
- Blocks: Teachers cannot set initial contract targets at creation without editing on the schedule page.

## Test Coverage Gaps

**Repositories without dedicated tests:**
- What's not tested: `src/lib/repos/students.repo.ts` (CRUD, `replaceStudents`, `appendStudents`), `src/lib/repos/attendance.repo.ts` (`setAbsent`, composite id).
- Files: `src/lib/repos/students.repo.ts`, `src/lib/repos/attendance.repo.ts`
- Risk: Cascade deletes and roster replace could regress silently.
- Priority: High for `replaceStudents` / `deleteStudentCascade`; Medium for attendance.

**Svelte routes and components:**
- What's not tested: All `src/routes/**/*.svelte` and `SemesterMap.svelte`; Vitest explicitly excludes `src/**/*.svelte.{test,spec}.*` in `vite.config.ts`.
- Risk: Form validation, `onblur` save paths, and optimistic attendance UX break without detection.
- Priority: Medium (add `@testing-library/svelte` or Playwright smoke later).

**Browser / E2E:**
- What's not tested: Full flows (create class → add lesson → mark absence) in a real browser.
- Risk: IndexedDB behavior differs from `fake-indexeddb` in edge cases.
- Priority: Low until sync or PWA features ship.

**`updateLesson` missing-id behavior:**
- What's not tested: Silent return when lesson absent.
- Files: `src/lib/repos/lessons.repo.ts`, `src/lib/repos/lessons.repo.test.ts`
- Risk: Callers assume throw or error result.
- Priority: Medium — assert throw `repoError` or return `false`.

**CSV import edge cases:**
- What's not tested: Quoted fields with embedded commas, UTF-8 BOM, RFC4180 edge cases.
- Files: `src/lib/logic/rosterImport.ts` (naive `firstCell` splits on first comma only)
- Risk: Mis-parsed names from Excel exports.
- Priority: Low unless users report bad imports.

---

*Concerns audit: 2026-05-15*
