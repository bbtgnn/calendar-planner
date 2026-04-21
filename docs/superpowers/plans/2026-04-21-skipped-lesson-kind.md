# Skipped Lesson Kind Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `skipped` session kind that records canceled lesson dates with a reason in `title`, always stores `0` hours, has no attendance, and is excluded from planned/done lesson metrics.

**Architecture:** Keep invariants in repositories (`lessons.repo`) so UI cannot persist invalid skipped rows. Update shared type union and route UIs to support the new kind while preserving existing class/extra behavior. Add targeted tests in repository/logic and a small UI-rules helper module so skipped UI behavior is unit-tested without adding a new component test stack.

**Tech Stack:** SvelteKit 2, Svelte 5, Dexie 4, Vitest, Bun.

---

## Scope check

This spec is one coherent subsystem (lesson session-kind expansion + related invariants/UI), so one implementation plan is appropriate.

---

## File map

- Modify: `src/lib/db/types.ts` — extend `LessonSessionKind` union.
- Modify: `src/lib/repos/lessons.repo.ts` — enforce skipped invariants and absence cleanup.
- Modify: `src/lib/repos/lessons.repo.test.ts` — TDD for skipped create/update/integrity behavior.
- Modify: `src/lib/logic/stats.test.ts` — assert skipped rows do not affect class/extra counts.
- Create: `src/lib/logic/sessionKindUi.ts` — small pure helpers for UI behavior flags/text.
- Create: `src/lib/logic/sessionKindUi.test.ts` — unit tests for add/detail/table UI behavior rules.
- Modify: `src/routes/class/[classId]/+page.svelte` — add “Skipped” in add form, lock hours to 0, reason label, skipped badge, done disabled for skipped.
- Modify: `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte` — include skipped option, force 0 hours on skipped, hide attendance for skipped, disable done while skipped.
- Modify: `docs/superpowers/specs/2026-04-20-lesson-planner-design.md` — update canonical product spec to include skipped kind semantics.

---

### Task 1: Repository invariants for skipped kind (TDD)

**Files:**
- Modify: `src/lib/db/types.ts`
- Modify: `src/lib/repos/lessons.repo.test.ts`
- Modify: `src/lib/repos/lessons.repo.ts`
- Test: `src/lib/repos/lessons.repo.test.ts`

- [ ] **Step 1: Extend the session kind union**

Update `src/lib/db/types.ts`:

```ts
export type LessonSessionKind = 'class' | 'extra' | 'skipped';
```

- [ ] **Step 2: Write failing repository tests for skipped behavior**

Append to `src/lib/repos/lessons.repo.test.ts`:

```ts
it('createLesson stores 0 hours for skipped sessions', async () => {
	const c = await createClass({ name: 'A', totalHoursTarget: 10 });
	const lesson = await createLesson({
		classId: c.id,
		date: '2026-05-02',
		durationHours: 2,
		title: 'Holiday',
		sessionKind: 'skipped'
	});
	expect(lesson.sessionKind).toBe('skipped');
	expect(lesson.durationHours).toBe(0);
	const row = await db.lessons.get(lesson.id);
	expect(row?.durationHours).toBe(0);
});

it('updateLesson to skipped coerces hours to 0 and clears absences atomically', async () => {
	const c = await createClass({ name: 'A', totalHoursTarget: 10 });
	const lesson = await createLesson({
		classId: c.id,
		date: '2026-05-03',
		durationHours: 1.5,
		title: 'L1'
	});
	const sid = crypto.randomUUID();
	await db.students.add({ id: sid, classId: c.id, name: 'S' });
	await db.absences.add({ id: `${lesson.id}__${sid}`, lessonId: lesson.id, studentId: sid });

	await updateLesson(lesson.id, { sessionKind: 'skipped' });
	const row = await db.lessons.get(lesson.id);
	expect(row?.sessionKind).toBe('skipped');
	expect(row?.durationHours).toBe(0);
	const absenceCount = await db.absences.where('lessonId').equals(lesson.id).count();
	expect(absenceCount).toBe(0);
});

it('updateLesson keeps skipped duration at 0 even if duration patch is provided', async () => {
	const c = await createClass({ name: 'A', totalHoursTarget: 10 });
	const lesson = await createLesson({
		classId: c.id,
		date: '2026-05-04',
		durationHours: 1,
		title: 'Skip me',
		sessionKind: 'skipped'
	});
	await updateLesson(lesson.id, { durationHours: 4 });
	const row = await db.lessons.get(lesson.id);
	expect(row?.durationHours).toBe(0);
});
```

- [ ] **Step 3: Run tests to verify failures**

Run:

```bash
bun run test -- src/lib/repos/lessons.repo.test.ts
```

Expected: FAIL on skipped tests (hours not coerced and/or absences not cleared yet).

- [ ] **Step 4: Implement skipped invariants in repository**

Update `src/lib/repos/lessons.repo.ts`:

```ts
export async function createLesson(input: {
	classId: ClassId;
	date: string;
	durationHours: number;
	title: string;
	sessionKind?: LessonSessionKind;
}): Promise<LessonRow> {
	const sessionKind = input.sessionKind ?? 'class';
	const row: LessonRow = {
		id: crypto.randomUUID(),
		classId: input.classId,
		date: input.date,
		durationHours: sessionKind === 'skipped' ? 0 : input.durationHours,
		title: input.title || 'Lesson',
		done: false,
		sessionKind
	};
	await db.lessons.add(row);
	return row;
}

export async function updateLesson(
	id: LessonId,
	patch: Partial<Pick<LessonRow, 'date' | 'durationHours' | 'title' | 'done' | 'sessionKind'>>
): Promise<void> {
	await db.transaction('rw', db.lessons, db.absences, async () => {
		const current = await db.lessons.get(id);
		if (!current) return;

		if (patch.sessionKind === 'extra' && current.sessionKind !== 'extra') {
			const n = await db.absences.where('lessonId').equals(id).count();
			if (n > 0) {
				throw new Error('SESSION_KIND_EXTRA_BLOCKED_ABSENCES');
			}
		}

		const nextKind = patch.sessionKind ?? current.sessionKind;
		const nextPatch: Partial<Pick<LessonRow, 'date' | 'durationHours' | 'title' | 'done' | 'sessionKind'>> = {
			...patch
		};

		if (nextKind === 'skipped') {
			nextPatch.durationHours = 0;
		}

		if (patch.sessionKind === 'skipped' && current.sessionKind !== 'skipped') {
			await db.absences.where('lessonId').equals(id).delete();
		}

		await db.lessons.update(id, nextPatch);
	});
}
```

- [ ] **Step 5: Run repository tests**

Run:

```bash
bun run test -- src/lib/repos/lessons.repo.test.ts
```

Expected: PASS for all tests in `lessons.repo.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/types.ts src/lib/repos/lessons.repo.ts src/lib/repos/lessons.repo.test.ts
git commit -m "feat(lessons): add skipped kind invariants and absence cleanup"
```

---

### Task 2: Metrics and UI rules tests for skipped semantics (TDD)

**Files:**
- Modify: `src/lib/logic/stats.test.ts`
- Create: `src/lib/logic/sessionKindUi.ts`
- Create: `src/lib/logic/sessionKindUi.test.ts`
- Test: `src/lib/logic/stats.test.ts`, `src/lib/logic/sessionKindUi.test.ts`

- [ ] **Step 1: Add skipped assertions to stats tests**

Append to `src/lib/logic/stats.test.ts`:

```ts
it('skipped sessions do not affect class/extra lesson counts', () => {
	const lessons: LessonForContractStats[] = [
		{ done: true, durationHours: 1, sessionKind: 'class' },
		{ done: false, durationHours: 1, sessionKind: 'extra' },
		{ done: true, durationHours: 0, sessionKind: 'skipped' }
	];
	expect(scheduledLessonCount(lessons)).toBe(1);
	expect(doneLessonCount(lessons)).toBe(1);
	expect(scheduledExtraSessionCount(lessons)).toBe(1);
	expect(doneExtraSessionCount(lessons)).toBe(0);
});
```

- [ ] **Step 2: Create failing UI rules tests**

Create `src/lib/logic/sessionKindUi.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
	attendanceVisibleForKind,
	doneEditableForKind,
	hoursEditableForKind,
	labelForTitleField,
	normalizedHoursForKind
} from './sessionKindUi';

describe('sessionKindUi', () => {
	it('forces skipped hours to zero', () => {
		expect(normalizedHoursForKind('skipped', 2)).toBe(0);
		expect(normalizedHoursForKind('class', 2)).toBe(2);
	});

	it('marks skipped title label as reason', () => {
		expect(labelForTitleField('skipped')).toBe('Reason');
		expect(labelForTitleField('class')).toBe('Title');
	});

	it('disables hours and done for skipped', () => {
		expect(hoursEditableForKind('skipped')).toBe(false);
		expect(doneEditableForKind('skipped')).toBe(false);
		expect(hoursEditableForKind('extra')).toBe(true);
	});

	it('hides attendance for non-class kinds', () => {
		expect(attendanceVisibleForKind('class')).toBe(true);
		expect(attendanceVisibleForKind('extra')).toBe(false);
		expect(attendanceVisibleForKind('skipped')).toBe(false);
	});
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
bun run test -- src/lib/logic/stats.test.ts src/lib/logic/sessionKindUi.test.ts
```

Expected: FAIL because `sessionKindUi.ts` does not exist yet.

- [ ] **Step 4: Implement `sessionKindUi` helpers**

Create `src/lib/logic/sessionKindUi.ts`:

```ts
import type { LessonSessionKind } from '$lib/db/types';

export function normalizedHoursForKind(kind: LessonSessionKind, hours: number): number {
	return kind === 'skipped' ? 0 : hours;
}

export function labelForTitleField(kind: LessonSessionKind): 'Title' | 'Reason' {
	return kind === 'skipped' ? 'Reason' : 'Title';
}

export function hoursEditableForKind(kind: LessonSessionKind): boolean {
	return kind !== 'skipped';
}

export function doneEditableForKind(kind: LessonSessionKind): boolean {
	return kind !== 'skipped';
}

export function attendanceVisibleForKind(kind: LessonSessionKind): boolean {
	return kind === 'class';
}
```

- [ ] **Step 5: Run logic tests**

Run:

```bash
bun run test -- src/lib/logic/stats.test.ts src/lib/logic/sessionKindUi.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/logic/stats.test.ts src/lib/logic/sessionKindUi.ts src/lib/logic/sessionKindUi.test.ts
git commit -m "test(logic): cover skipped metrics and ui rules"
```

---

### Task 3: Schedule page support for skipped rows

**Files:**
- Modify: `src/routes/class/[classId]/+page.svelte`
- Test: `bun run check`, `bun run test`

- [ ] **Step 1: Import UI helper functions**

At top of `src/routes/class/[classId]/+page.svelte` add:

```ts
import {
	doneEditableForKind,
	hoursEditableForKind,
	labelForTitleField,
	normalizedHoursForKind
} from '$lib/logic/sessionKindUi';
```

- [ ] **Step 2: Support skipped kind in add-form state and coercion**

Update defaults and `addLesson()`:

```ts
let newSessionKind = $state<LessonSessionKind>('class');

async function addLesson() {
	if (!newDate) {
		showToast('Pick a date for the new lesson.');
		return;
	}
	const h = Number(newHours);
	if (!Number.isFinite(h) || h < 0) {
		showToast('Enter a valid non-negative number of hours.');
		return;
	}
	try {
		await withRetry(() =>
			createLesson({
				classId: data.class.id,
				date: newDate,
				durationHours: normalizedHoursForKind(newSessionKind, h),
				title: newTitle,
				sessionKind: newSessionKind
			})
		);
		newDate = '';
		newHours = 2;
		newTitle = 'Lesson';
		newSessionKind = 'class';
		await refresh();
	} catch {
		showToast('Could not add lesson.');
	}
}
```

- [ ] **Step 3: Update add form UI for skipped**

Update the add form controls:

```svelte
<label>
	Hours (teacher)
	<input
		type="number"
		min="0"
		step="0.25"
		bind:value={newHours}
		disabled={!hoursEditableForKind(newSessionKind)}
	/>
</label>
<label>
	{labelForTitleField(newSessionKind)}
	<input type="text" bind:value={newTitle} />
</label>
<label>
	Kind
	<select
		bind:value={newSessionKind}
		onchange={() => {
			if (newSessionKind === 'skipped') newHours = 0;
		}}
	>
		<option value="class">Class</option>
		<option value="extra">Extra / 1:1</option>
		<option value="skipped">Skipped</option>
	</select>
</label>
```

- [ ] **Step 4: Render skipped badge and disable done toggle for skipped**

Update table row rendering:

```svelte
<span
	class="badge"
	class:badge-class={lesson.sessionKind === 'class'}
	class:badge-extra={lesson.sessionKind === 'extra'}
	class:badge-skipped={lesson.sessionKind === 'skipped'}
>
	{lesson.sessionKind === 'class'
		? 'Class'
		: lesson.sessionKind === 'extra'
			? 'Extra'
			: 'Skipped'}
</span>
```

```svelte
<input
	type="checkbox"
	checked={lesson.done}
	disabled={!doneEditableForKind(lesson.sessionKind)}
	onchange={(e) => toggleDone(lesson, (e.currentTarget as HTMLInputElement).checked)}
/>
```

Add style:

```css
.badge-skipped {
	background: #f1f3f4;
	color: #3c4043;
}
```

- [ ] **Step 5: Run checks and tests**

Run:

```bash
bun run check
bun run test
```

Expected: `svelte-check` reports 0 errors; test suite passes.

- [ ] **Step 6: Commit**

```bash
git add "src/routes/class/[classId]/+page.svelte"
git commit -m "feat(schedule): add skipped kind to create/list flow"
```

---

### Task 4: Lesson detail support for skipped rows

**Files:**
- Modify: `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`
- Test: `bun run check`, `bun run test`

- [ ] **Step 1: Import helper functions**

At top of lesson detail file add:

```ts
import {
	attendanceVisibleForKind,
	doneEditableForKind,
	hoursEditableForKind,
	labelForTitleField,
	normalizedHoursForKind
} from '$lib/logic/sessionKindUi';
```

- [ ] **Step 2: Normalize skipped kind updates**

Update kind change handler:

```ts
async function changeSessionKind(next: LessonSessionKind) {
	const prev = sessionKind;
	sessionKind = next;
	durationHours = normalizedHoursForKind(next, Number(durationHours));
	try {
		await withRetry(() =>
			updateLesson(data.lesson.id, {
				sessionKind: next,
				durationHours: normalizedHoursForKind(next, Number(durationHours))
			})
		);
		await refresh();
	} catch (e) {
		sessionKind = prev;
		const msg = e instanceof Error ? e.message : String(e);
		if (msg.includes('SESSION_KIND_EXTRA_BLOCKED_ABSENCES')) {
			showToast('Clear all absences for this session before marking it as Extra.');
		} else {
			showToast('Could not update session kind.');
		}
	}
}
```

- [ ] **Step 3: Update field behavior for skipped**

Use helper-driven UI behavior:

```svelte
<label>
	Hours
	<input
		type="number"
		min="0"
		step="0.25"
		bind:value={durationHours}
		disabled={!hoursEditableForKind(sessionKind)}
		onblur={persistLessonMeta}
	/>
</label>
<label>
	{labelForTitleField(sessionKind)}
	<input type="text" bind:value={title} onblur={persistLessonMeta} />
</label>
```

Add skipped option:

```svelte
<option value="class">Class</option>
<option value="extra">Extra / 1:1</option>
<option value="skipped">Skipped</option>
```

Disable done while skipped:

```svelte
<input
	type="checkbox"
	bind:checked={done}
	disabled={!doneEditableForKind(sessionKind)}
	onchange={() => {
		if (!doneEditableForKind(sessionKind)) {
			done = false;
			return;
		}
		void persistLessonMeta();
	}}
/>
```

- [ ] **Step 4: Hide attendance for skipped and extra**

Replace attendance condition block:

```svelte
{#if !attendanceVisibleForKind(sessionKind)}
	<p class="muted">
		{sessionKind === 'skipped'
			? 'Skipped sessions do not have attendance.'
			: 'No class attendance for Extra / 1:1 sessions.'}
	</p>
{:else if students.length === 0}
	<p class="muted">Add students on the Students tab to record absences.</p>
{:else}
	<!-- existing attendance list -->
{/if}
```

- [ ] **Step 5: Ensure meta save always normalizes skipped hours**

Update `persistLessonMeta()` payload:

```ts
await withRetry(() =>
	updateLesson(data.lesson.id, {
		date,
		durationHours: normalizedHoursForKind(sessionKind, h),
		title,
		done: doneEditableForKind(sessionKind) ? done : false,
		sessionKind
	})
);
```

- [ ] **Step 6: Run checks and tests**

Run:

```bash
bun run check
bun run test
```

Expected: all checks/tests pass.

- [ ] **Step 7: Commit**

```bash
git add "src/routes/class/[classId]/lesson/[lessonId]/+page.svelte"
git commit -m "feat(lesson): support skipped kind and hide attendance"
```

---

### Task 5: Update canonical lesson-planner design doc and verify end-to-end

**Files:**
- Modify: `docs/superpowers/specs/2026-04-20-lesson-planner-design.md`
- Test: full suite + manual UAT checklist

- [ ] **Step 1: Update design doc references for session kinds**

Patch relevant sections in `docs/superpowers/specs/2026-04-20-lesson-planner-design.md`:

```md
- **`scheduledLessonCount`**: count of **class** sessions only (`sessionKind === 'class'`), not Extra / 1:1 / Skipped rows.
- **`doneLessonCount`**: among **class** sessions only, count with `done === true`.
```

```md
| Scheduled lesson count | **Class** sessions only (`sessionKind === 'class'`) |
| Done lesson count | **Class** sessions with `done === true` (Extra and Skipped sessions are tracked separately / excluded from planned lesson metrics) |
```

```md
- **Skipped sessions:** allowed as `sessionKind === 'skipped'`, reason stored in `title`, `durationHours` forced to 0, no attendance, excluded from planned/done lesson metrics.
```

- [ ] **Step 2: Run final automated verification**

Run:

```bash
bun run check
bun run test
```

Expected: all pass.

- [ ] **Step 3: Manual UAT verification**

Run this checklist in app:

```md
- Create a skipped session from Add session:
  - Kind = Skipped
  - Hours auto-sets to 0 and cannot be edited
  - Title label reads Reason
- Confirm skipped row appears in chronological sessions table with Skipped badge and 0 hours.
- Confirm skipped row done checkbox is disabled.
- Open skipped lesson detail:
  - attendance area hidden with skipped-specific message
  - hours not editable
- Convert class session with existing absences to skipped:
  - conversion succeeds
  - absences are cleared
- Confirm stats lines for class/extra counts do not change when adding/removing skipped rows.
```

- [ ] **Step 4: Commit docs + any final fixes**

```bash
git add docs/superpowers/specs/2026-04-20-lesson-planner-design.md
git commit -m "docs(spec): document skipped session kind behavior"
```

---

## Self-review

### 1) Spec coverage

- Third kind `skipped` + reason via `title`: Tasks 1, 3, 4.
- `durationHours = 0` invariant: Tasks 1, 3, 4.
- Mixed chronological row (same table): Task 3.
- No planned/done metric impact: Task 2 + Task 5 UAT.
- No attendance for skipped: Tasks 1, 4.
- Tests for repo/stats/UI rules: Tasks 1, 2.

No coverage gaps found.

### 2) Placeholder scan

No `TBD`, `TODO`, “implement later”, or undefined references remain.

### 3) Type consistency

- `LessonSessionKind` consistently used as `class | extra | skipped`.
- UI helpers consume `LessonSessionKind` and are used by both schedule and lesson detail pages.
- Repository normalization uses the same kind semantics as UI helpers.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-21-skipped-lesson-kind.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
