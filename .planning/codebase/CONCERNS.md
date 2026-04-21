# Codebase Concerns

**Analysis Date:** 2026-04-21

## Tech Debt

**Skipped-session invariants are split across UI and repo (Severity: High):**
- Issue: `durationHours` normalization, title labeling, attendance visibility, and done toggling are enforced in both UI helpers and repository logic instead of a single domain layer.
- Files: `src/lib/repos/lessons.repo.ts`, `src/lib/logic/sessionKindUi.ts`, `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`
- Impact: The `skipped` flow can drift when new entry points are added (imports, scripts, future API routes), creating invalid states that the UI masks.
- Fix approach: Move all `sessionKind` transition rules to repository/service-level guards and keep UI logic presentational only.

**Validation remains decentralized and stringly typed (Severity: Medium):**
- Issue: Non-negative checks, empty-title handling, and kind-transition errors are implemented ad hoc in route components and with string message matching.
- Files: `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`, `src/lib/repos/lessons.repo.ts`, `src/lib/db/withRetry.ts`
- Impact: Behavior diverges between screens and retries can re-surface low-context error messages.
- Fix approach: Add shared domain validators and typed error codes consumed by both UI routes.

## Known Bugs

**Attendance can still be persisted for skipped sessions (Severity: High):**
- Symptoms: `setAbsent()` accepts any `lessonId` regardless of `sessionKind`, so skipped lessons can regain absences if called outside guarded UI paths.
- Files: `src/lib/repos/attendance.repo.ts`, `src/lib/repos/lessons.repo.ts`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`
- Trigger: Scripted calls, future UI regressions, or stale page state invoking attendance writes after a switch to `skipped`.
- Workaround: None at repository boundary; currently relies on page-level hidden controls.

**Skipped lessons are not hard-coerced to `done=false` at repository level (Severity: Medium):**
- Symptoms: `updateLesson()` forces skipped hours to `0` but does not guarantee `done=false` when kind changes to `skipped`.
- Files: `src/lib/repos/lessons.repo.ts`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`, `src/routes/class/[classId]/+page.svelte`
- Trigger: Any caller that updates `sessionKind: 'skipped'` without also sending `done: false`.
- Workaround: Current route UIs pass `done: false` on kind-change paths.

## Security Considerations

**Student roster and attendance stay as local cleartext browser data (Severity: Medium):**
- Risk: Teacher/student data is retained in IndexedDB with no encryption or role separation.
- Files: `src/lib/db/client.ts`, `src/lib/repos/students.repo.ts`, `src/lib/repos/attendance.repo.ts`
- Current mitigation: Local-only persistence and no remote sync path.
- Recommendations: Add privacy controls (wipe/export), and document shared-device operating guidance.

## Performance Bottlenecks

**Roster replacement uses per-student absence deletes (Severity: Medium):**
- Problem: `replaceStudents()` deletes absences inside a loop, then performs additional class-wide deletes/inserts.
- Files: `src/lib/repos/students.repo.ts`
- Cause: N+1 delete strategy in one transaction.
- Improvement path: Resolve existing student IDs once and use `anyOf()` bulk delete + bulk insert.

**Schedule view recomputes many aggregates per reactive update (Severity: Low):**
- Problem: Multiple `$derived` stats each iterate `lessons`, including class/extra counters tied to skipped semantics.
- Files: `src/routes/class/[classId]/+page.svelte`, `src/lib/logic/stats.ts`
- Cause: Repeated filtering/reducing over the same in-memory array.
- Improvement path: Build one aggregate stats object and derive UI fields from that memoized structure.

## Fragile Areas

**Stats correctness depends on skipped-hour invariant remaining true (Severity: High):**
- Files: `src/lib/logic/stats.ts`, `src/lib/repos/lessons.repo.ts`, `src/lib/db/types.ts`
- Why fragile: Totals include all durations and assume skipped rows are always `0`; any non-zero skipped duration corrupts contract metrics.
- Safe modification: Enforce invariant in repository and add explicit guard tests for illegal duration updates on skipped rows.
- Test coverage: Unit checks exist in `src/lib/repos/lessons.repo.test.ts` and `src/lib/logic/stats.test.ts`, but there is no cross-layer integration test proving UI + repo coherence.

**Domain error handling still relies on string matching (Severity: Medium):**
- Files: `src/lib/repos/lessons.repo.ts`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`
- Why fragile: Transition failures branch on `msg.includes('SESSION_KIND_EXTRA_BLOCKED_ABSENCES')`.
- Safe modification: Export stable error constants/enums and map them in UI without substring checks.
- Test coverage: No UI-level automated assertion for error-code-to-toast mapping.

## Scaling Limits

**Single-device IndexedDB architecture limits durability and team usage (Severity: High):**
- Current capacity: One browser profile per teacher with quota-based storage.
- Limit: Data loss on profile reset/storage eviction; no built-in cross-device continuity.
- Scaling path: Add export/import backups first, then optional sync service for multi-device use.

## Dependencies at Risk

**Dexie schema upgrades lack migration regression depth for session-kind evolution (Severity: Medium):**
- Risk: Future schema changes around `sessionKind` and class targets can regress old records silently.
- Impact: Existing records may carry inconsistent defaults after version bumps.
- Migration plan: Add versioned migration fixtures/tests around `src/lib/db/client.ts` beyond smoke coverage in `src/lib/db/client.smoke.test.ts`.

## Missing Critical Features

**No invariant-enforcing attendance guard for non-class sessions (Severity: High):**
- Problem: There is no repository-level check that blocks attendance writes when lesson kind is `extra` or `skipped`.
- Blocks: Reliable data integrity if new callers bypass route UI controls.

**No durable backup/recovery workflow (Severity: High):**
- Problem: Operational planning data has no first-class export/restore path.
- Blocks: Safe production use and recovery after local profile corruption.

## Test Coverage Gaps

**Skipped flow lacks defensive repository tests for invalid callers (Severity: High):**
- What's not tested: Preventing `setAbsent()` on skipped/extra lessons and coercing `done=false` when switching to skipped.
- Files: `src/lib/repos/attendance.repo.ts`, `src/lib/repos/lessons.repo.ts`, `src/lib/repos/lessons.repo.test.ts`
- Risk: Data model can enter inconsistent states through non-UI call paths.
- Priority: High

**UI behavior for skipped transitions is not component/integration tested (Severity: Medium):**
- What's not tested: Detail-page and schedule-page state transitions, including race/retry behavior during kind switches.
- Files: `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`, `src/lib/db/withRetry.ts`
- Risk: Regression in skipped UX can silently reintroduce invalid writes or misleading toasts.
- Priority: Medium

---

*Concerns audit: 2026-04-21*
