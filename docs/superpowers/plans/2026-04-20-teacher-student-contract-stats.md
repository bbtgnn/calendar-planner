# Teacher–student contract stats & session kind — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `sessionKind` (`class` | `extra`) to lessons, `requiredStudentLessonHours` (M) on classes, Dexie migration, contract-focused stats (N teacher hours, M student lesson hours), attendance only for class sessions, and block Class→Extra while absences exist.

**Architecture:** Keep **pure domain math** in `src/lib/logic/stats.ts` (unit-tested). **Persist** new fields via Dexie **version 2** with an `upgrade` that backfills defaults. **Repositories** stay thin; `lessons.repo` enforces the absence rule when changing `sessionKind` to `extra`. **Routes** bind derived stats and forms; lesson detail **branches** UI on `sessionKind`.

**Tech Stack:** SvelteKit 2, Svelte 5, Dexie 4, Vitest, Bun (`bun run test`).

**Spec source:** Brainstorming decisions (2026-04-20): teacher-hour target N; student lesson hours M (separate field); `durationHours` = **teacher hours** (60‑min); student hours = ×(60/50); hero metrics include **unplanned class (teacher h)**, **max extra (teacher h)**, **remaining flex (teacher h)**, and **total unscheduled contract (teacher h)**; lesson counts for “lessons” = **class only**; Extra has separate session counts; Class→Extra blocked if absences exist.

**Execution order:** Run **Task 2** (types + Dexie v2 + repo defaults) **before** **Task 1** so `LessonSessionKind` lives only in `src/lib/db/types.ts` and `stats.ts` uses `import type { LessonSessionKind } from '$lib/db/types'`. Remove duplicate `export type LessonSessionKind` from the Task 1 snippet when implementing.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/db/types.ts` | `LessonSessionKind`, `requiredStudentLessonHours` on `ClassRow`, `sessionKind` on `LessonRow` |
| `src/lib/db/client.ts` | Dexie **v2** schema + `upgrade` backfill |
| `src/lib/logic/stats.ts` | Conversion constants, sums by kind, contract metrics (unplanned, max extra, remaining flex, unscheduled total), class-only lesson counts |
| `src/lib/logic/stats.test.ts` | Vitest coverage for all exported stat helpers |
| `src/lib/repos/classes.repo.ts` | `createClass` / `updateClass` accept `requiredStudentLessonHours` |
| `src/lib/repos/lessons.repo.ts` | `createLesson` default `sessionKind: 'class'`; `updateLesson` validates absence rule when switching to `extra` |
| `src/lib/repos/attendance.repo.ts` | `countAbsencesForLesson(lessonId)` |
| `src/routes/class/[classId]/+page.svelte` | Targets N + M, stats panel, add-lesson kind, table badges, class-only done % |
| `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte` | Session kind control, hide attendance for `extra`, block UI path to extra with absences |
| `src/lib/repos/classes.repo.test.ts` | Fixture rows include new fields |
| `src/lib/db/client.smoke.test.ts` | Class `put` includes `requiredStudentLessonHours` |

---

### Task 1: Contract math in `stats.ts` (TDD)

**Files:**
- Modify: `src/lib/logic/stats.ts`
- Modify: `src/lib/logic/stats.test.ts`
- Test: `bun run test` → `stats.test.ts` passes

**Definitions (locked):**

- `N` = contract teacher hours (`totalHoursTarget`).
- `M` = `requiredStudentLessonHours` (50‑minute **student lesson** hours).
- `T_class` / `T_extra` = sums of `durationHours` over lessons with `sessionKind` `class` / `extra`.
- `C_min = M × (50/60)` = minimum **teacher hours** of **class** needed to cover M (same as `M/60×50` when read as `(M/60)*50`).

**Exported helpers (implement exactly these names for downstream tasks):**

```ts
import type { LessonSessionKind } from '$lib/db/types';

export const TEACHER_MINUTES_PER_TEACHER_HOUR = 60;
export const STUDENT_MINUTES_PER_STUDENT_HOUR = 50;

export type LessonForContractStats = {
	durationHours: number;
	done: boolean;
	sessionKind: LessonSessionKind;
};

/** Teacher hours → student hours (50‑min units). */
export function studentHoursFromTeacherHours(teacherHours: number): number {
	return teacherHours * (TEACHER_MINUTES_PER_TEACHER_HOUR / STUDENT_MINUTES_PER_STUDENT_HOUR);
}

/** M (student lesson hours) → minimum class teacher hours to cover M. */
export function minimumClassTeacherHoursForStudentLessonHours(studentLessonHours: number): number {
	return studentLessonHours * (STUDENT_MINUTES_PER_STUDENT_HOUR / TEACHER_MINUTES_PER_TEACHER_HOUR);
}

export function sumTeacherHoursForKind(
	lessons: LessonForContractStats[],
	kind: LessonSessionKind
): number {
	return lessons.filter((l) => l.sessionKind === kind).reduce((s, l) => s + l.durationHours, 0);
}

/** max(0, C_min − T_class) */
export function unplannedClassTeacherHours(
	requiredStudentLessonHours: number,
	classTeacherHoursScheduled: number
): number {
	const cMin = minimumClassTeacherHoursForStudentLessonHours(requiredStudentLessonHours);
	return Math.max(0, cMin - classTeacherHoursScheduled);
}

/** N − C_min (may be negative if contract cannot cover M — return raw number; UI can clamp). */
export function maxExtraTeacherHours(contractTeacherHours: number, requiredStudentLessonHours: number): number {
	const cMin = minimumClassTeacherHoursForStudentLessonHours(requiredStudentLessonHours);
	return contractTeacherHours - cMin;
}

/**
 * Flex pool after "more class beyond C_min" and scheduled extra:
 * max(0, (N − C_min) − max(0, T_class − C_min) − T_extra)
 */
export function remainingFlexTeacherHours(
	contractTeacherHours: number,
	requiredStudentLessonHours: number,
	classTeacherHoursScheduled: number,
	extraTeacherHoursScheduled: number
): number {
	const cMin = minimumClassTeacherHoursForStudentLessonHours(requiredStudentLessonHours);
	const pool = contractTeacherHours - cMin;
	const beyondClass = Math.max(0, classTeacherHoursScheduled - cMin);
	return Math.max(0, pool - beyondClass - extraTeacherHoursScheduled);
}

/** N − T_class − T_extra (total contract hours not yet placed on calendar). */
export function totalUnscheduledContractTeacherHours(
	contractTeacherHours: number,
	classTeacherHoursScheduled: number,
	extraTeacherHoursScheduled: number
): number {
	return contractTeacherHours - classTeacherHoursScheduled - extraTeacherHoursScheduled;
}

export function scheduledClassLessonCount(lessons: LessonForContractStats[]): number {
	return lessons.filter((l) => l.sessionKind === 'class').length;
}

export function doneClassLessonCount(lessons: LessonForContractStats[]): number {
	return lessons.filter((l) => l.sessionKind === 'class' && l.done).length;
}

export function scheduledExtraSessionCount(lessons: LessonForContractStats[]): number {
	return lessons.filter((l) => l.sessionKind === 'extra').length;
}

export function doneExtraSessionCount(lessons: LessonForContractStats[]): number {
	return lessons.filter((l) => l.sessionKind === 'extra' && l.done).length;
}

/** Student hours (50‑min) from scheduled class teacher hours only. */
export function studentLessonHoursDeliveredFromClass(classTeacherHoursScheduled: number): number {
	return studentHoursFromTeacherHours(classTeacherHoursScheduled);
}
```

- [ ] **Step 1: Add failing tests** — Append to `src/lib/logic/stats.test.ts` cases that import the new functions and assert:
  - `studentHoursFromTeacherHours(5)` → `6` (5 teacher h → 6 student h).
  - `minimumClassTeacherHoursForStudentLessonHours(6)` → `5`.
  - `unplannedClassTeacherHours(6, 5)` → `0`; `unplannedClassTeacherHours(6, 4)` → `1`.
  - `maxExtraTeacherHours(20, 6)` → `15` (C_min=5).
  - `remainingFlexTeacherHours(20, 6, 7, 2)` → `6` (pool 15, beyondClass 2, extra 2 → 15−2−2=11… recalculate: N=20, M=6, C_min=5, pool=15, T_class=7 beyond = 2, T_extra=2 → 15-2-2=11). **Fix numbers in test** so hand-calculated result is obvious: use `N=10, M=6, C_min=5, T_class=6, T_extra=1` → pool=5, beyondClass=1, remaining flex = 5-1-1 = **3**. Assert `remainingFlexTeacherHours(10, 6, 6, 1) === 3`.
  - `totalUnscheduledContractTeacherHours(10, 6, 1)` → `3`.
  - Class-only counts: two class (one done), one extra → `scheduledClassLessonCount` 2, `doneClassLessonCount` 1, `scheduledExtraSessionCount` 1.

- [ ] **Step 2: Run tests — expect new imports to fail**

Run: `bun run test`

Expected: FAIL (missing exports or wrong values).

- [ ] **Step 3: Implement** — Add the code block above to `src/lib/logic/stats.ts` (keep existing exports `sumScheduledHours`, `remainingHours` unless superseded: **retain** `sumScheduledHours` for backward compatibility but schedule page will migrate to kind-aware sums; either reimplement `sumScheduledHours` as sum of all kinds or add `sumScheduledTeacherHours(lessons)` = T_class + T_extra). **Add** `sumScheduledTeacherHours(lessons: LessonForContractStats[]): number` as sum of all `durationHours`.

```ts
export function sumScheduledTeacherHours(lessons: LessonForContractStats[]): number {
	return lessons.reduce((s, l) => s + l.durationHours, 0);
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/logic/stats.ts src/lib/logic/stats.test.ts
git commit -m "feat(stats): contract hours, session-kind splits, flex helpers"
```

---

### Task 2: Dexie v2 — types + migration + tests

**Files:**
- Modify: `src/lib/db/types.ts`
- Modify: `src/lib/db/client.ts`
- Modify: `src/lib/repos/classes.repo.ts` (`createClass` default `requiredStudentLessonHours: 0`)
- Modify: `src/lib/repos/lessons.repo.ts` (`LessonRow` in `createLesson` includes `sessionKind: 'class'`)
- Modify: `src/lib/db/client.smoke.test.ts`
- Modify: `src/lib/repos/classes.repo.test.ts`

- [ ] **Step 1: Extend types** — In `src/lib/db/types.ts`:

```ts
export type LessonSessionKind = 'class' | 'extra';

export type ClassRow = {
	id: ClassId;
	name: string;
	totalHoursTarget: number;
	/** Student lesson hours required (50‑minute units). */
	requiredStudentLessonHours: number;
	createdAt: number;
};

export type LessonRow = {
	id: LessonId;
	classId: ClassId;
	date: string;
	durationHours: number;
	title: string;
	done: boolean;
	sessionKind: LessonSessionKind;
};
```

- [ ] **Step 2: Bump Dexie** — In `src/lib/db/client.ts`, add **version 2** after version 1:

```ts
constructor() {
	super('lesson-planner-db');
	this.version(1).stores({
		classes: 'id, name, createdAt',
		students: 'id, classId, name',
		lessons: 'id, classId, date, done',
		absences: 'id, lessonId, studentId'
	});
	this.version(2)
		.stores({
			classes: 'id, name, createdAt',
			students: 'id, classId, name',
			lessons: 'id, classId, date, done, sessionKind',
			absences: 'id, lessonId, studentId'
		})
		.upgrade(async (trans) => {
			await trans
				.table('classes')
				.toCollection()
				.modify((c: ClassRow) => {
					if (c.requiredStudentLessonHours === undefined) c.requiredStudentLessonHours = 0;
				});
			await trans
				.table('lessons')
				.toCollection()
				.modify((l: LessonRow) => {
					if (l.sessionKind === undefined) l.sessionKind = 'class';
				});
		});
}
```

Import `ClassRow` / `LessonRow` types for `modify` callbacks (or use inline types).

- [ ] **Step 3: `createClass`** — Default:

```ts
requiredStudentLessonHours: input.requiredStudentLessonHours ?? 0,
```

Extend `createClass` input type with optional `requiredStudentLessonHours?: number`.

- [ ] **Step 4: `updateClass` patch** — Allow `Partial<Pick<ClassRow, 'name' | 'totalHoursTarget' | 'requiredStudentLessonHours'>>`.

- [ ] **Step 5: `createLesson`** — Build `row` with `sessionKind: input.sessionKind ?? 'class'`. Extend input: `sessionKind?: LessonSessionKind`.

- [ ] **Step 6: `updateLesson` patch** — Include `sessionKind` in `Partial<Pick<LessonRow, ...>>`.

- [ ] **Step 7: Fix tests** — `client.smoke.test.ts` class `put` must include `requiredStudentLessonHours: 0`. `classes.repo.test.ts` manual `db.lessons.add` must include `sessionKind: 'class'`.

- [ ] **Step 8: Run tests**

Run: `bun run test`

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/db/types.ts src/lib/db/client.ts src/lib/repos/classes.repo.ts src/lib/repos/lessons.repo.ts src/lib/db/client.smoke.test.ts src/lib/repos/classes.repo.test.ts
git commit -m "feat(db): v2 class M + lesson sessionKind with upgrade"
```

---

### Task 3: Block Class→Extra when absences exist

**Files:**
- Modify: `src/lib/repos/attendance.repo.ts`
- Modify: `src/lib/repos/lessons.repo.ts`

- [ ] **Step 1: Count absences**

```ts
export async function countAbsencesForLesson(lessonId: LessonId): Promise<number> {
	return db.absences.where('lessonId').equals(lessonId).count();
}
```

- [ ] **Step 2: Guard in `updateLesson`** — Before applying a patch that sets `sessionKind: 'extra'`, load current lesson (or pass through transaction). If new kind is `extra` and `countAbsencesForLesson(id) > 0`, throw:

```ts
throw new Error('SESSION_KIND_EXTRA_BLOCKED_ABSENCES');
```

If patch does not include `sessionKind`, no check. If current is already `extra`, no check.

- [ ] **Step 3: Commit**

```bash
git add src/lib/repos/attendance.repo.ts src/lib/repos/lessons.repo.ts
git commit -m "feat(lessons): block extra session kind while absences exist"
```

---

### Task 4: Schedule page — targets, stats, list, add form

**Files:**
- Modify: `src/routes/class/[classId]/+page.svelte`

- [ ] **Step 1: Imports** — Import new stats helpers and `LessonSessionKind`. Use `LessonRow` with `sessionKind`.

- [ ] **Step 2: State** — `let targetStudentLessonHours = $state(0)` synced from `data.class.requiredStudentLessonHours` via `$effect` alongside `targetHours`.

- [ ] **Step 3: Derived** — From `lessons` as `LessonForContractStats[]` (map rows to include `sessionKind`), compute:

  - `tClass = sumTeacherHoursForKind(lessons, 'class')`
  - `tExtra = sumTeacherHoursForKind(lessons, 'extra')`
  - `unplanned = unplannedClassTeacherHours(targetStudentLessonHours, tClass)`
  - `maxExtra = maxExtraTeacherHours(targetHours, targetStudentLessonHours)`
  - `remainingFlex = remainingFlexTeacherHours(targetHours, targetStudentLessonHours, tClass, tExtra)`
  - `totalUnsched = totalUnscheduledContractTeacherHours(targetHours, tClass, tExtra)`
  - Class-only done %: `scheduledClassLessonCount`, `doneClassLessonCount` from stats
  - Extra session counts for display

- [ ] **Step 4: Save handlers** — `saveTarget` also persists `requiredStudentLessonHours` with validation (finite, ≥ 0). Optionally two buttons or one “Save targets” saving both.

- [ ] **Step 5: UI — targets grid** — Second input: “Student lesson hours target (50‑min units)” bound to `targetStudentLessonHours`.

- [ ] **Step 6: UI — hero stats** — Clear labels:

  - **Unplanned class (teacher h):** `{unplanned.toFixed(2)}`
  - **Max extra (teacher h, from N and M):** show `maxExtra` (if negative, show value and short hint that N < minimum for M)
  - **Remaining flex (teacher h):** `{remainingFlex.toFixed(2)}`
  - **Unscheduled on contract (teacher h):** `{totalUnsched.toFixed(2)}`

- [ ] **Step 7: Add lesson** — Select: Class / Extra (default Class). Pass `sessionKind` into `createLesson`.

- [ ] **Step 8: Table** — Column or badge: “Class” vs “Extra” using `lesson.sessionKind`. Use a `<span class="badge">` with distinct classes for styling (minimal CSS in same file `<style>`).

- [ ] **Step 9: Done %** — Replace global lesson count with **class-only**: `doneClassLessonCount(lessons) / scheduledClassLessonCount(lessons)`; guard zero. Show separate line: **Extra sessions done:** `doneExtraSessionCount` / `scheduledExtraSessionCount`.

- [ ] **Step 10: Commit**

```bash
git add src/routes/class/[classId]/+page.svelte
git commit -m "feat(schedule): M target, contract stats, session kind on create/list"
```

---

### Task 5: Lesson detail — session kind + conditional attendance

**Files:**
- Modify: `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`
- Modify: `src/routes/class/[classId]/lesson/[lessonId]/+page.ts` — only if you need to pass extra data (prefer reading `data.lesson.sessionKind` from load)

- [ ] **Step 1: Local state** — `sessionKind` synced from `data.lesson` in the same `$effect` as other fields.

- [ ] **Step 2: Control** — `<select>` or radio for Class / Extra; on change call `updateLesson` with `sessionKind`. **Catch** `SESSION_KIND_EXTRA_BLOCKED_ABSENCES` message: `showToast('Clear all absences on the Students tab before marking this as Extra.')` — parse `e instanceof Error && e.message`.

Actually throw string check: `String(err).includes('SESSION_KIND_EXTRA_BLOCKED_ABSENCES')`.

- [ ] **Step 3: Attendance** — Wrap existing attendance block in `{#if data.lesson.sessionKind === 'class'}` (use live `sessionKind` after successful update). For `extra`, show: “No class attendance for Extra / 1:1 sessions.”

- [ ] **Step 4: Persist** — Include `sessionKind` in `persistLessonMeta` payload when saving meta (date, hours, title, done).

- [ ] **Step 5: Commit**

```bash
git add "src/routes/class/[classId]/lesson/[lessonId]/+page.svelte"
git commit -m "feat(lesson): session kind editor and attendance gating"
```

---

### Task 6: Align `stats.ts` legacy exports (if still used)

- [ ] **Step 1:** Grep for `sumScheduledHours`, `scheduledLessonCount`, `doneLessonCount` in `src/`.

- [ ] **Step 2:** Either update call sites to `sumScheduledTeacherHours` + contract types, or keep thin wrappers:

```ts
export function scheduledLessonCount(lessons: LessonForContractStats[]): number {
	return scheduledClassLessonCount(lessons);
}
export function doneLessonCount(lessons: LessonForContractStats[]): number {
	return doneClassLessonCount(lessons);
}
```

Only if removing old `scheduledLessonCount(lessons: unknown[])` — **prefer** updating `+page.svelte` to use new names and **delete** ambiguous helpers to avoid accidental misuse.

- [ ] **Step 3:** `bun run test` and `bun run check` (if available).

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor(stats): align lesson counts with class-only semantics"
```

(Adjust if split commits preferred.)

---

## Self-review

| Spec item | Task |
|-----------|------|
| N teacher target + M student lesson hours | Task 2, 4 |
| `sessionKind` + badge | Task 2, 4 |
| Conversion & contract formulas | Task 1 |
| Hero stats: unplanned class (teacher h), max extra, remaining flex, unscheduled total | Task 1, 4 |
| Lesson counts class-only; extra separate | Task 1, 4 |
| Attendance only class; block Class→Extra with absences | Task 3, 5 |
| Dexie migration defaults | Task 2 |

**Placeholder scan:** None.

**Type consistency:** `LessonSessionKind` is defined **only** in `src/lib/db/types.ts` (Task 2). `stats.ts` imports it (Task 1).

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-20-teacher-student-contract-stats.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. REQUIRED SUB-SKILL: superpowers:executing-plans.

**Which approach?**
