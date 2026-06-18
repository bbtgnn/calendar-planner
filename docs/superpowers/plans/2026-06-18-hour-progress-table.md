# Hour progress table — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three planned-only stat boxes with a 4×3 contract/planned/done table on the class page.

**Architecture:** Add `buildHourProgressRows` and `sumDoneTeacherHoursForKind` in `stats.ts` (TDD); update `+page.svelte` to render a table; remove dead `buildTeacherHourStatBoxes` API.

**Tech Stack:** Svelte 5, Vitest, Bun (`bun run test`).

**Spec:** `docs/superpowers/specs/2026-06-18-hour-progress-table-design.md`

---

### Task 1: `sumDoneTeacherHoursForKind` + tests

**Files:**
- Modify: `src/lib/logic/stats.ts`
- Modify: `src/lib/logic/stats.test.ts`

- [ ] Add failing test for per-kind done hour sums
- [ ] Implement `sumDoneTeacherHoursForKind`
- [ ] `bun run test src/lib/logic/stats.test.ts`

### Task 2: `buildHourProgressRows` + tests

**Files:**
- Modify: `src/lib/logic/stats.ts`
- Modify: `src/lib/logic/stats.test.ts`

- [ ] Replace `buildTeacherHourStatBoxes` tests with `buildHourProgressRows` coverage (4 rows, skipped, warning, student conversion)
- [ ] Implement `buildHourProgressRows`; remove `TeacherHourStatBox`, `buildTeacherHourStatBoxes`, `makeStatBox`, unused format helpers
- [ ] `bun run test src/lib/logic/stats.test.ts`

### Task 3: Class page table UI

**Files:**
- Modify: `src/routes/class/[classId]/+page.svelte`

- [ ] Swap `buildTeacherHourStatBoxes` → `buildHourProgressRows`
- [ ] Replace `.stats-summary` markup with `<table>` (Contract / Planned / Done columns)
- [ ] Remove tier/stat-box CSS; add minimal table styles

### Task 4: Verify

- [ ] `bun run test`
- [ ] Svelte autofixer on `+page.svelte`
