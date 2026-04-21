# Codebase Concerns

**Analysis Date:** 2026-04-21

## Tech Debt

**Contract stats + session-kind rules spread across UI/repo (Severity: High):**
- Issue: Core contract calculations and session-kind constraints are implemented in multiple layers (`src/lib/logic/stats.ts`, `src/lib/repos/lessons.repo.ts`, `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`) with string-based coupling for rule failures.
- Files: `src/lib/logic/stats.ts`, `src/lib/repos/lessons.repo.ts`, `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`
- Impact: Future changes to formula semantics or session-kind transitions can drift between repository behavior and UI messaging.
- Fix approach: Introduce typed domain errors/constants (e.g. exported error codes), centralize derived contract metrics in a dedicated service module, and keep UI as a thin projection layer.

**Input validation is decentralized (Severity: Medium):**
- Issue: Validation rules for hours/title/name exist in route components rather than shared domain validators (`Number.isFinite`, non-negative checks, trim checks done ad hoc).
- Files: `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`, `src/routes/class/[classId]/students/+page.svelte`, `src/routes/+layout.svelte`
- Impact: Rule drift and regressions are likely as new entry points (bulk edit/import/API sync later) are added.
- Fix approach: Add shared validator functions in `src/lib/logic/` and enforce in repositories before writes.

## Known Bugs

**CSV parsing breaks on quoted commas (Severity: High):**
- Symptoms: Names containing commas (e.g. `"Smith, John"`) split incorrectly because parsing uses first raw comma rather than RFC-compliant CSV handling.
- Files: `src/lib/logic/rosterImport.ts`, `src/routes/class/[classId]/students/+page.svelte`
- Trigger: Importing CSV rows with quoted delimiters or escaped quotes.
- Workaround: Pre-clean CSV to plain first-column names without embedded commas.

**Attendance can be written for mismatched class relationships (Severity: Medium):**
- Symptoms: `setAbsent()` writes by `lessonId` + `studentId` without verifying the student belongs to the lesson's class.
- Files: `src/lib/repos/attendance.repo.ts`, `src/lib/repos/students.repo.ts`, `src/lib/repos/lessons.repo.ts`
- Trigger: Future UI bug or script calling `setAbsent()` with cross-class IDs.
- Workaround: None at repository boundary; currently relies on UI selecting valid IDs.

## Security Considerations

**PII persistence without explicit protection controls (Severity: Medium):**
- Risk: Student names and attendance are stored in browser IndexedDB without encryption, retention controls, or explicit privacy safeguards.
- Files: `src/lib/db/client.ts`, `src/lib/repos/students.repo.ts`, `src/lib/repos/attendance.repo.ts`
- Current mitigation: Browser-local storage only; no remote transmission path in current code.
- Recommendations: Add privacy UX (clear-all/export-delete), document device-level threat model, and gate app usage with local profile separation guidance for shared devices.

**Class preference ID in localStorage is unscoped (Severity: Low):**
- Risk: Persistent class IDs in `localStorage` can leak usage metadata across browser sessions on shared devices.
- Files: `src/lib/preferences/activeClass.ts`
- Current mitigation: Value is opaque ID only.
- Recommendations: Add opt-out toggle and wipe preference on explicit privacy mode/logout flow (if introduced).

## Performance Bottlenecks

**Roster replacement does per-student absence deletes (Severity: Medium):**
- Problem: `replaceStudents()` loops existing students and performs separate deletes before bulk class delete/insert.
- Files: `src/lib/repos/students.repo.ts`
- Cause: N+1 delete pattern in IndexedDB transaction.
- Improvement path: Batch delete absences with `anyOf(existingIds)` and use bulk insert (`bulkAdd`) for new roster entries.

**Derived stats recomputed from full lesson arrays in component layer (Severity: Low):**
- Problem: Multiple `$derived` calculations each iterate lessons in `+page.svelte`.
- Files: `src/routes/class/[classId]/+page.svelte`, `src/lib/logic/stats.ts`
- Cause: Repeated filtering/reducing over same dataset for every reactive recalculation.
- Improvement path: Compute a single memoized aggregate object (class hours, extra hours, counts) and derive UI fields from it.

## Fragile Areas

**String-matched domain error handling (Severity: High):**
- Files: `src/lib/repos/lessons.repo.ts`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`
- Why fragile: Business rule branching depends on `'SESSION_KIND_EXTRA_BLOCKED_ABSENCES'` text matching (`includes`) rather than typed discriminants.
- Safe modification: Export canonical error symbol/code and assert exact identity at call sites.
- Test coverage: Repository behavior is tested in `src/lib/repos/lessons.repo.test.ts`, but UI mapping of error-to-toast path has no automated test.

**Auto-save behavior tied to blur/change events (Severity: Medium):**
- Files: `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`
- Why fragile: `onblur` persistence can miss unsaved edits on abrupt navigation/tab close; partial updates can interleave with attendance refresh.
- Safe modification: Move to explicit save queue/debounce with unload guard and optimistic state reconciliation.
- Test coverage: No component/integration tests validate save sequencing or race behavior.

## Scaling Limits

**Browser-only IndexedDB model has device-bound capacity and durability limits (Severity: High):**
- Current capacity: Single-device storage with no replication; practical limits tied to browser quota and manual device backup habits.
- Limit: Data is lost on browser profile reset/storage eviction; no cross-device continuity for teachers.
- Scaling path: Add export/import backup (encrypted optional), then optional sync backend for multi-device continuity.

## Dependencies at Risk

**Dexie schema evolution risk without migration regression tests (Severity: Medium):**
- Risk: Future schema upgrades can silently regress existing user data if upgrade handlers miss defaults.
- Impact: Inconsistent `requiredStudentLessonHours`/`sessionKind` values or broken reads after version bump.
- Migration plan: Add migration-focused tests that seed v1-shaped records and assert v2+ upgrade outcomes in `src/lib/db/client.ts`.

## Missing Critical Features

**No durable backup/recovery workflow (Severity: High):**
- Problem: Operationally critical teacher planning data has no built-in backup/export.
- Blocks: Safe adoption for production-like use, incident recovery after profile corruption.

**No audit trail for destructive operations (Severity: Medium):**
- Problem: Class delete and roster replace are irreversible after confirmation.
- Blocks: Safe rollback of accidental destructive actions in `src/lib/repos/classes.repo.ts` and `src/lib/repos/students.repo.ts`.

## Test Coverage Gaps

**Business-critical UI flows are untested (Severity: High):**
- What's not tested: End-to-end correctness of contract metrics display, session-kind switch UX, attendance gating, and destructive confirmations.
- Files: `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`, `src/routes/class/[classId]/students/+page.svelte`
- Risk: Regressions in newly introduced business logic can ship undetected despite repo/unit coverage.
- Priority: High

**Repository edge cases under-tested (Severity: Medium):**
- What's not tested: `students.repo.ts` append/replace duplicate handling, `attendance.repo.ts` integrity checks, and larger transaction behavior.
- Files: `src/lib/repos/students.repo.ts`, `src/lib/repos/attendance.repo.ts`
- Risk: Data integrity drift and performance regressions under real rosters.
- Priority: Medium

---

*Concerns audit: 2026-04-21*
