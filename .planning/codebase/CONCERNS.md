# Codebase Concerns

**Analysis Date:** 2026-04-20

## Tech Debt

**Monolithic route components:**
- Issue: Schedule, students, and root layout bundle data loading, validation, and persistence in large `.svelte` files instead of smaller modules or shared hooks.
- Files: `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/students/+page.svelte`, `src/routes/+layout.svelte`
- Impact: Harder to reuse logic, review, and test; higher risk of inconsistent error handling when editing UI.
- Fix approach: Extract repo call sites into small `*.ts` helpers or a thin “actions” layer; keep components mostly presentational.

**Non-transactional bulk student append:**
- Issue: `appendStudents` loops `db.students.add` without a Dexie transaction, unlike `replaceStudents` and cascade deletes.
- Files: `src/lib/repos/students.repo.ts`
- Impact: Interrupted run (tab close, storage error) can leave a partially imported roster with no automatic rollback.
- Fix approach: Wrap the loop in `db.transaction('rw', db.students, async () => { ... })` or use `bulkAdd`.

**Unused adapter dependency:**
- Issue: `package.json` lists `@sveltejs/adapter-auto` while `svelte.config.js` uses `@sveltejs/adapter-static` only.
- Files: `package.json`, `svelte.config.js`
- Impact: Confusion for contributors and unnecessary install surface.
- Fix approach: Remove `adapter-auto` from devDependencies if not planned for use.

**Schema evolution not exercised:**
- Issue: Dexie is pinned to `version(1)` with no upgrade hooks; any future index or table change must add migrations.
- Files: `src/lib/db/client.ts`
- Impact: Risk of silent breakage or duplicate logic when the schema grows.
- Fix approach: Document upgrade steps; add `.upgrade()` handlers when introducing `version(2)`.

## Known Bugs

**CSV roster import and quoted commas:**
- Symptoms: Names or first-column values containing commas inside RFC 4180-style quotes can parse incorrectly; only the substring before the first comma is used.
- Files: `src/lib/logic/rosterImport.ts` (`firstCell`, `parseCsvNames`)
- Trigger: Import a CSV export where the name field is quoted and includes commas.
- Workaround: Use `.txt` one-name-per-line imports or pre-process CSV to remove inner commas.

## Security Considerations

**No authentication or multi-tenant isolation:**
- Risk: All classes, students, lessons, and attendance live in the browser’s IndexedDB for the origin; anyone with access to the same browser profile can read or change data via devtools or the app UI.
- Files: `src/lib/db/client.ts`, all files under `src/lib/repos/`
- Current mitigation: None by design (local-first SPA).
- Recommendations: If deployment moves to a shared or managed environment, add auth, server-side storage, or device-level expectations in product docs.

**Client-only data and shared devices:**
- Risk: `localStorage` stores last visited class id (`lesson-planner:last-class-id`); combined with IndexedDB, a shared machine exposes prior teacher data until storage is cleared.
- Files: `src/lib/preferences/activeClass.ts`, `src/routes/class/[classId]/+layout.svelte`, `src/routes/+page.svelte`
- Current mitigation: Data stays on device; no network exfiltration in app code reviewed.
- Recommendations: Document privacy expectations; consider optional “lock” or profile switch if product scope expands.

## Performance Bottlenecks

**Sequential bulk inserts:**
- Problem: `appendStudents` awaits one `add` per name; large imports perform O(n) round-trips to IndexedDB.
- Files: `src/lib/repos/students.repo.ts`
- Cause: Per-row `add` without batching.
- Improvement path: `bulkAdd`, a single transaction, or chunked batches for very large rosters.

**Heavy cascade deletes for large classes:**
- Problem: `deleteClassCascade` loads primary keys then issues broad `anyOf` deletes; acceptable for typical class sizes but scales with lesson and student counts.
- Files: `src/lib/repos/classes.repo.ts`
- Cause: IndexedDB delete patterns and lack of server-side aggregation.
- Improvement path: Batch deletes or archival UX if classes grow unusually large.

## Fragile Areas

**Retry helper rethrows non-`Error` values:**
- Files: `src/lib/db/withRetry.ts`
- Why fragile: After retries, `throw last` may throw a non-`Error` `unknown`, which complicates logging and uniform error UI.
- Safe modification: Normalize to `Error` or narrow type before rethrow; log `last` in callers when adding diagnostics.
- Test coverage: Covered only by unit tests in `src/lib/db/withRetry.test.ts`; no integration tests with real IndexedDB failures.

**Load functions depend on IndexedDB in the client:**
- Files: `src/routes/class/[classId]/+layout.ts`, `src/routes/class/[classId]/lesson/[lessonId]/+page.ts`, `src/lib/repos/*.ts`
- Why fragile: Correct behavior assumes `ssr = false` and browser APIs; turning SSR on without guards would break loads.
- Safe modification: Keep `src/routes/+layout.ts` `ssr`/`prerender` policy aligned with Dexie usage; gate DB access with `browser` if server loads are ever enabled.

## Scaling Limits

**IndexedDB and static SPA deployment:**
- Current capacity: Browser quota per origin; typical multi-megabyte to hundreds of MB depending on browser and disk.
- Limit: No cross-browser sync; clearing site data wipes all planner content; no server backup.
- Scaling path: Export/import, optional cloud sync, or backend API if multi-device or compliance requirements appear.

## Dependencies at Risk

**Not detected:** No abandoned core libraries observed in `package.json`; `dexie`, SvelteKit, and Vitest are actively maintained. Risk is operational (schema and upgrade discipline) rather than package abandonment.

## Missing Critical Features

**Backup, restore, and portability:**
- Problem: No first-class export/import of full database or per-class archive in application code reviewed.
- Blocks: Disaster recovery and moving data between devices without manual IndexedDB tooling.

## Test Coverage Gaps

**Repository layers mostly untested:**
- What's not tested: `lessons.repo.ts`, `students.repo.ts`, `attendance.repo.ts` have no dedicated `*.test.ts` files; cascade and transaction behavior for students and lessons relies on manual verification.
- Files: `src/lib/repos/lessons.repo.ts`, `src/lib/repos/students.repo.ts`, `src/lib/repos/attendance.repo.ts`
- Risk: Regressions in `deleteLessonCascade`, `deleteStudentCascade`, or `replaceStudents` may ship unnoticed.
- Priority: High for data-integrity paths; medium for simple CRUD.

**Route and UI layers:**
- What's not tested: No `*.svelte` tests; no Playwright/Cypress E2E; user flows (add lesson, mark attendance, import roster) are unautomated.
- Files: `src/routes/**/*.svelte`
- Risk: Visual or interaction regressions after refactors.
- Priority: Medium.

**Smoke test scope:**
- What's not tested: `src/lib/db/client.smoke.test.ts` only verifies a single `classes` put/get/delete cycle, not lessons, students, or absences together.
- Files: `src/lib/db/client.smoke.test.ts`
- Risk: False confidence that “DB works” for the full schema.
- Priority: Low to medium.

---

*Concerns audit: 2026-04-20*
