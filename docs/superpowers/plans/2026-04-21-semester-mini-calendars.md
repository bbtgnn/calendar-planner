# Semester mini-calendars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-class manual semester start/end persisted on `ClassRow`, and a view-only horizontal strip of small Monday-first monthly calendars on `/class/[classId]` with colored dots per `sessionKind` (skipped = red).

**Architecture:** Keep date-only rules and aggregations in a small pure module `src/lib/logic/semesterCalendar.ts` with Vitest coverage. Dexie schema v3 adds nullable `semesterStart` / `semesterEnd` with an upgrade backfill. `updateClass` merges patches, validates the resulting semester pair, then writes. UI is a colocated Svelte subview imported by `+page.svelte`, reusing existing toast/`withRetry` patterns and CSS variables for dot colors aligned with table badges (class blue, extra purple, skipped red).

**Tech Stack:** SvelteKit 2, Svelte 5, Dexie 4, Vitest, Bun.

**Spec:** `docs/superpowers/specs/2026-04-21-semester-mini-calendars-design.md`

---

## Scope check

Single subsystem (schema + repo validation + pure calendar math + one route UI). One plan is sufficient.

---

## File map

| Path | Responsibility |
|------|----------------|
| `src/lib/logic/semesterCalendar.ts` | Pure helpers: ISO date compare, in-semester check, list `YYYY-MM` months in range, Monday-first 42-cell month grid, unique kinds per date, merge + assert valid semester bounds for repo |
| `src/lib/logic/semesterCalendar.test.ts` | Unit tests for all exported helpers |
| `src/lib/db/types.ts` | Add `semesterStart` / `semesterEnd` to `ClassRow` |
| `src/lib/db/client.ts` | Dexie `version(3)` upgrade: ensure new fields exist on `classes` rows |
| `src/lib/db/client.smoke.test.ts` | Extend sample `put` to include new fields |
| `src/lib/repos/classes.repo.ts` | Default nulls on `createClass`; `updateClass` patch type + merged semester validation before `db.classes.update` |
| `src/lib/repos/classes.repo.test.ts` | Tests for semester create defaults and update validation errors |
| `src/routes/class/[classId]/SemesterMap.svelte` | Semester card: date inputs, Save button, legend, scrollable month strip (dots + muted out-of-range) |
| `src/routes/class/[classId]/+page.svelte` | Import `SemesterMap`, pass `data.class`, `lessons`, wire refresh after save |
| `docs/superpowers/specs/2026-04-20-lesson-planner-design.md` | Short “Semester map” subsection pointing to the 2026-04-21 design spec |

---

### Task 1: Pure `semesterCalendar` logic (TDD)

**Files:**

- Create: `src/lib/logic/semesterCalendar.ts`
- Create: `src/lib/logic/semesterCalendar.test.ts`
- Test: `src/lib/logic/semesterCalendar.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/logic/semesterCalendar.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { LessonSessionKind } from '$lib/db/types';
import {
	compareIsoDate,
	isDateInSemester,
	listYearMonthsInRange,
	monthGridMondayFirst,
	formatYearMonthHeading,
	uniqueKindsByDate,
	mergeSemesterFields,
	assertValidSemesterBounds
} from './semesterCalendar';

describe('semesterCalendar', () => {
	it('compareIsoDate orders YYYY-MM-DD lexicographically', () => {
		expect(compareIsoDate('2026-04-01', '2026-04-02')).toBeLessThan(0);
		expect(compareIsoDate('2026-04-02', '2026-04-02')).toBe(0);
		expect(compareIsoDate('2026-05-01', '2026-04-30')).toBeGreaterThan(0);
	});

	it('isDateInSemester is inclusive on start and end', () => {
		expect(isDateInSemester('2026-04-10', '2026-04-10', '2026-04-20')).toBe(true);
		expect(isDateInSemester('2026-04-20', '2026-04-10', '2026-04-20')).toBe(true);
		expect(isDateInSemester('2026-04-09', '2026-04-10', '2026-04-20')).toBe(false);
		expect(isDateInSemester('2026-04-21', '2026-04-10', '2026-04-20')).toBe(false);
	});

	it('listYearMonthsInRange covers partial months and cross-year', () => {
		expect(listYearMonthsInRange('2026-04-05', '2026-04-20')).toEqual(['2026-04']);
		expect(listYearMonthsInRange('2026-01-01', '2026-03-31')).toEqual(['2026-01', '2026-02', '2026-03']);
		expect(listYearMonthsInRange('2025-11-15', '2026-02-10')).toEqual([
			'2025-11',
			'2025-12',
			'2026-01',
			'2026-02'
		]);
	});

	it('monthGridMondayFirst returns 42 cells with pads outside the month', () => {
		const cells = monthGridMondayFirst('2026-04');
		expect(cells).toHaveLength(42);
		const dated = cells.filter((c): c is { isoDate: string } => 'isoDate' in c);
		expect(dated).toHaveLength(30);
		expect(dated[0].isoDate).toBe('2026-04-01');
		expect(dated[dated.length - 1].isoDate).toBe('2026-04-30');
	});

	it('formatYearMonthHeading uses UTC month name', () => {
		expect(formatYearMonthHeading('2026-04')).toBe('April 2026');
	});

	it('uniqueKindsByDate dedupes kinds per date', () => {
		const lessons = [
			{ date: '2026-04-01', sessionKind: 'class' as LessonSessionKind },
			{ date: '2026-04-01', sessionKind: 'class' as LessonSessionKind },
			{ date: '2026-04-01', sessionKind: 'extra' as LessonSessionKind }
		];
		const m = uniqueKindsByDate(lessons);
		expect([...(m.get('2026-04-01') ?? [])].sort()).toEqual(['class', 'extra']);
	});

	it('assertValidSemesterBounds accepts both null', () => {
		expect(() => assertValidSemesterBounds(null, null)).not.toThrow();
	});

	it('assertValidSemesterBounds rejects one-sided set', () => {
		expect(() => assertValidSemesterBounds('2026-04-01', null)).toThrow(/both/);
		expect(() => assertValidSemesterBounds(null, '2026-04-01')).toThrow(/both/);
	});

	it('assertValidSemesterBounds rejects start after end', () => {
		expect(() => assertValidSemesterBounds('2026-04-10', '2026-04-01')).toThrow(/before/);
	});

	it('mergeSemesterFields applies patch over existing', () => {
		const merged = mergeSemesterFields(
			{ semesterStart: '2026-01-01', semesterEnd: '2026-06-01' },
			{ semesterEnd: '2026-05-01' }
		);
		expect(merged).toEqual({ semesterStart: '2026-01-01', semesterEnd: '2026-05-01' });
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
bun run test -- src/lib/logic/semesterCalendar.test.ts
```

Expected: FAIL (module not found or missing exports).

- [ ] **Step 3: Implement `semesterCalendar.ts`**

Create `src/lib/logic/semesterCalendar.ts`:

```typescript
import type { LessonRow, LessonSessionKind } from '$lib/db/types';

export function compareIsoDate(a: string, b: string): number {
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}

export function isDateInSemester(isoDate: string, start: string, end: string): boolean {
	return compareIsoDate(isoDate, start) >= 0 && compareIsoDate(isoDate, end) <= 0;
}

/** Inclusive list of `YYYY-MM` calendar months from startIso through endIso. */
export function listYearMonthsInRange(startIso: string, endIso: string): string[] {
	const [ys, ms] = startIso.split('-').map(Number);
	const [ye, me] = endIso.split('-').map(Number);
	const out: string[] = [];
	let y = ys;
	let m = ms;
	while (y < ye || (y === ye && m <= me)) {
		out.push(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`);
		m += 1;
		if (m > 12) {
			m = 1;
			y += 1;
		}
	}
	return out;
}

export type MonthCell = { isoDate: string } | { pad: true };

/** 6×7 grid, Monday-first week row; `pad` cells are outside the requested month. */
export function monthGridMondayFirst(yearMonth: string): MonthCell[] {
	const [Y, M] = yearMonth.split('-').map(Number);
	const first = new Date(Date.UTC(Y, M - 1, 1));
	const dow = first.getUTCDay();
	const mondayOffset = (dow + 6) % 7;
	const gridStart = new Date(Date.UTC(Y, M - 1, 1 - mondayOffset));
	const cells: MonthCell[] = [];
	for (let i = 0; i < 42; i++) {
		const t = gridStart.getTime() + i * 86400000;
		const d = new Date(t);
		const yy = d.getUTCFullYear();
		const mm = d.getUTCMonth() + 1;
		const dd = d.getUTCDate();
		if (yy === Y && mm === M) {
			cells.push({
				isoDate: `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
			});
		} else {
			cells.push({ pad: true });
		}
	}
	return cells;
}

/** e.g. `2026-04` → `April 2026` (UTC, en-US) for month titles. */
export function formatYearMonthHeading(yearMonth: string): string {
	const [y, m] = yearMonth.split('-').map(Number);
	const d = new Date(Date.UTC(y, m - 1, 1));
	return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function uniqueKindsByDate(
	lessons: Pick<LessonRow, 'date' | 'sessionKind'>[]
): Map<string, Set<LessonSessionKind>> {
	const map = new Map<string, Set<LessonSessionKind>>();
	for (const l of lessons) {
		let s = map.get(l.date);
		if (!s) {
			s = new Set();
			map.set(l.date, s);
		}
		s.add(l.sessionKind);
	}
	return map;
}

export function mergeSemesterFields(
	existing: { semesterStart: string | null; semesterEnd: string | null },
	patch: Partial<{ semesterStart: string | null; semesterEnd: string | null }>
): { semesterStart: string | null; semesterEnd: string | null } {
	return {
		semesterStart: patch.semesterStart !== undefined ? patch.semesterStart : existing.semesterStart,
		semesterEnd: patch.semesterEnd !== undefined ? patch.semesterEnd : existing.semesterEnd
	};
}

/** Throws `Error` with a user-facing message if the pair is invalid. */
export function assertValidSemesterBounds(start: string | null, end: string | null): void {
	if (start === null && end === null) return;
	if (start === null || end === null) {
		throw new Error('Semester start and end must both be set, or both cleared.');
	}
	if (compareIsoDate(start, end) > 0) {
		throw new Error('Semester start must be on or before semester end.');
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
bun run test -- src/lib/logic/semesterCalendar.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/logic/semesterCalendar.ts src/lib/logic/semesterCalendar.test.ts
git commit -m "feat: add pure semester calendar helpers"
```

---

### Task 2: Dexie v3 + `ClassRow` fields + create defaults

**Files:**

- Modify: `src/lib/db/types.ts`
- Modify: `src/lib/db/client.ts`
- Modify: `src/lib/repos/classes.repo.ts`
- Modify: `src/lib/db/client.smoke.test.ts`
- Test: `src/lib/db/client.smoke.test.ts` (via full unit run in Step 4)

- [ ] **Step 1: Extend `ClassRow`**

In `src/lib/db/types.ts`, extend `ClassRow`:

```typescript
export type ClassRow = {
	id: ClassId;
	name: string;
	totalHoursTarget: number;
	requiredStudentLessonHours: number;
	createdAt: number;
	semesterStart: string | null;
	semesterEnd: string | null;
};
```

- [ ] **Step 2: Add Dexie version 3 upgrade**

In `src/lib/db/client.ts`, after the existing `version(2)` block, chain:

```typescript
this.version(3)
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
				if (c.semesterStart === undefined) c.semesterStart = null;
				if (c.semesterEnd === undefined) c.semesterEnd = null;
			});
	});
```

- [ ] **Step 3: Default nulls in `createClass`**

In `src/lib/repos/classes.repo.ts`, add to the `row` literal in `createClass`:

```typescript
semesterStart: null,
semesterEnd: null,
```

- [ ] **Step 4: Fix smoke test insert shape**

In `src/lib/db/client.smoke.test.ts`, extend the object passed to `db.classes.put`:

```typescript
semesterStart: null,
semesterEnd: null,
```

- [ ] **Step 5: Run tests**

Run:

```bash
bun run test
```

Expected: PASS (Vitest resets DB per test file where applicable).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/types.ts src/lib/db/client.ts src/lib/repos/classes.repo.ts src/lib/db/client.smoke.test.ts
git commit -m "feat: persist semester bounds on ClassRow (Dexie v3)"
```

---

### Task 3: `updateClass` semester validation (TDD)

**Files:**

- Modify: `src/lib/repos/classes.repo.ts`
- Modify: `src/lib/repos/classes.repo.test.ts`
- Test: `src/lib/repos/classes.repo.test.ts`

- [ ] **Step 1: Write failing tests**

In `src/lib/repos/classes.repo.test.ts`, extend the existing `classes.repo` import to include `updateClass`, then append:

```typescript
it('createClass defaults semester fields to null', async () => {
	const c = await createClass({ name: 'S', totalHoursTarget: 1 });
	expect(c.semesterStart).toBeNull();
	expect(c.semesterEnd).toBeNull();
});

it('updateClass rejects semester with only start set', async () => {
	const c = await createClass({ name: 'S', totalHoursTarget: 1 });
	await expect(updateClass(c.id, { semesterStart: '2026-04-01' })).rejects.toThrow(/both/);
});

it('updateClass rejects start after end', async () => {
	const c = await createClass({ name: 'S', totalHoursTarget: 1 });
	await expect(
		updateClass(c.id, { semesterStart: '2026-05-01', semesterEnd: '2026-04-01' })
	).rejects.toThrow(/before/);
});

it('updateClass accepts cleared pair and valid pair', async () => {
	const c = await createClass({ name: 'S', totalHoursTarget: 1 });
	await updateClass(c.id, { semesterStart: '2026-04-01', semesterEnd: '2026-04-30' });
	let row = await db.classes.get(c.id);
	expect(row?.semesterStart).toBe('2026-04-01');
	await updateClass(c.id, { semesterStart: null, semesterEnd: null });
	row = await db.classes.get(c.id);
	expect(row?.semesterStart).toBeNull();
	expect(row?.semesterEnd).toBeNull();
});
```

Add missing import for `updateClass` at top of file (merge with existing imports from `classes.repo`).

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
bun run test -- src/lib/repos/classes.repo.test.ts
```

Expected: FAIL on new tests until `updateClass` implements validation.

- [ ] **Step 3: Implement validation in `updateClass`**

At top of `src/lib/repos/classes.repo.ts`:

```typescript
import { assertValidSemesterBounds, mergeSemesterFields } from '$lib/logic/semesterCalendar';
```

Replace `updateClass` signature patch type with:

```typescript
patch: Partial<
	Pick<ClassRow, 'name' | 'totalHoursTarget' | 'requiredStudentLessonHours' | 'semesterStart' | 'semesterEnd'>
>
```

Replace function body with:

```typescript
export async function updateClass(
	id: ClassId,
	patch: Partial<
		Pick<ClassRow, 'name' | 'totalHoursTarget' | 'requiredStudentLessonHours' | 'semesterStart' | 'semesterEnd'>
	>
): Promise<void> {
	const existing = await getClass(id);
	if (!existing) throw new Error('Class not found.');
	const mergedSemester = mergeSemesterFields(
		{
			semesterStart: existing.semesterStart ?? null,
			semesterEnd: existing.semesterEnd ?? null
		},
		{
			semesterStart: patch.semesterStart,
			semesterEnd: patch.semesterEnd
		}
	);
	assertValidSemesterBounds(mergedSemester.semesterStart, mergedSemester.semesterEnd);
	await db.classes.update(id, patch);
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
bun run test -- src/lib/repos/classes.repo.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repos/classes.repo.ts src/lib/repos/classes.repo.test.ts
git commit -m "feat: validate semester bounds on class update"
```

---

### Task 4: `SemesterMap` UI + `+page.svelte` integration

**Files:**

- Create: `src/routes/class/[classId]/SemesterMap.svelte`
- Modify: `src/routes/class/[classId]/+page.svelte`
- Test: manual in browser; rely on prior unit tests for math/repo

- [ ] **Step 1: Create `SemesterMap.svelte`**

Create `src/routes/class/[classId]/SemesterMap.svelte` with this complete implementation (adjust imports if `$lib` aliases differ — they match the rest of the repo):

```svelte
<script lang="ts">
	import type { ClassRow, LessonRow } from '$lib/db/types';
	import { updateClass } from '$lib/repos/classes.repo';
	import { withRetry } from '$lib/db/withRetry';
	import { showToast } from '$lib/stores/toast';
	import {
		assertValidSemesterBounds,
		isDateInSemester,
		listYearMonthsInRange,
		monthGridMondayFirst,
		formatYearMonthHeading,
		uniqueKindsByDate
	} from '$lib/logic/semesterCalendar';

	type Props = {
		class: ClassRow;
		lessons: LessonRow[];
		onSemesterSaved?: (next: ClassRow) => void;
	};

	let { class: klass, lessons, onSemesterSaved }: Props = $props();

	let startInput = $state('');
	let endInput = $state('');

	$effect(() => {
		startInput = klass.semesterStart ?? '';
		endInput = klass.semesterEnd ?? '';
	});

	const kindsMap = $derived(uniqueKindsByDate(lessons));

	async function saveSemester() {
		const a = startInput.trim();
		const b = endInput.trim();
		try {
			if (a === '' && b === '') {
				await withRetry(() =>
					updateClass(klass.id, { semesterStart: null, semesterEnd: null })
				);
				showToast('Semester cleared.');
				onSemesterSaved?.({
					...klass,
					semesterStart: null,
					semesterEnd: null
				});
				return;
			}
			if (a === '' || b === '') {
				showToast('Set both semester start and end, or clear both.');
				return;
			}
			assertValidSemesterBounds(a, b);
			await withRetry(() =>
				updateClass(klass.id, { semesterStart: a, semesterEnd: b })
			);
			showToast('Semester saved.');
			onSemesterSaved?.({
				...klass,
				semesterStart: a,
				semesterEnd: b
			});
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Could not save semester.';
			showToast(msg);
		}
	}

	const stripVisible = $derived(klass.semesterStart !== null && klass.semesterEnd !== null);

	const yearMonths = $derived(
		stripVisible && klass.semesterStart && klass.semesterEnd
			? listYearMonthsInRange(klass.semesterStart, klass.semesterEnd)
			: []
	);

	const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
</script>

<section class="card semester-card">
	<h2>Semester</h2>
	<div class="grid sem-grid">
		<label>
			Start
			<input type="date" bind:value={startInput} />
		</label>
		<label>
			End
			<input type="date" bind:value={endInput} />
		</label>
		<button type="button" class="btn" onclick={() => void saveSemester()}>Save semester</button>
	</div>
	{#if !stripVisible}
		<p class="muted">Set semester start and end to see the map.</p>
	{:else}
		<div class="legend" aria-hidden="true">
			<span><i class="dot class"></i> Class</span>
			<span><i class="dot extra"></i> Extra / 1:1</span>
			<span><i class="dot skipped"></i> Skipped</span>
		</div>
		<div class="strip" role="region" aria-label="Semester months" tabindex="0">
			{#each yearMonths as ym (ym)}
				<div class="mini-month">
					<h3 class="month-title">{formatYearMonthHeading(ym)}</h3>
					<div class="dow">{#each weekdays as w}<span>{w}</span>{/each}</div>
					<div class="cells">
						{#each monthGridMondayFirst(ym) as cell (cell)}
							{#if 'pad' in cell}
								<div class="cell pad"></div>
							{:else}
								{@const inS =
									klass.semesterStart &&
									klass.semesterEnd &&
									isDateInSemester(cell.isoDate, klass.semesterStart, klass.semesterEnd)}
								<div class="cell" class:muted={!inS}>
									<span class="dnum">{Number(cell.isoDate.slice(8))}</span>
									{#if inS}
										<div class="dots">
											{#each [...(kindsMap.get(cell.isoDate) ?? [])].sort() as k (k)}
												<i class="dot {k}"></i>
											{/each}
										</div>
									{/if}
								</div>
							{/if}
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.semester-card {
		--dot-class: #174ea6;
		--dot-extra: #6a1b9a;
		--dot-skipped: #c5221f;
	}
	h2 {
		margin: 0 0 0.75rem;
		font-size: 1.1rem;
	}
	h3.month-title {
		margin: 0 0 0.35rem;
		font-size: 0.8rem;
		font-weight: 600;
	}
	.sem-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: flex-end;
		margin-bottom: 0.5rem;
	}
	.sem-grid label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
	}
	.btn {
		padding: 0.4rem 0.75rem;
		border: 1px solid #c9ced6;
		background: #fff;
		border-radius: 6px;
		cursor: pointer;
		align-self: center;
	}
	.muted {
		color: #666;
		font-size: 0.9rem;
		margin: 0.25rem 0 0;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1rem;
		font-size: 0.8rem;
		margin: 0.5rem 0;
		align-items: center;
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.strip {
		display: flex;
		flex-direction: row;
		gap: 0.65rem;
		overflow-x: auto;
		padding-bottom: 0.25rem;
	}
	.mini-month {
		flex: 0 0 auto;
		min-width: 168px;
		border: 1px solid #e2e5eb;
		border-radius: 6px;
		padding: 0.35rem 0.4rem 0.5rem;
		background: #fafbff;
	}
	.dow {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		font-size: 0.6rem;
		color: #555;
		text-align: center;
		margin-bottom: 0.15rem;
	}
	.cells {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 1px;
	}
	.cell {
		min-height: 2.1rem;
		border-radius: 3px;
		background: #fff;
		border: 1px solid #eceef2;
		padding: 0.1rem 0.15rem;
		font-size: 0.65rem;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.cell.pad {
		background: transparent;
		border-color: transparent;
	}
	.cell.muted {
		opacity: 0.38;
		background: #f4f4f4;
	}
	.dnum {
		font-weight: 600;
		line-height: 1;
	}
	.dots {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		justify-content: center;
		margin-top: 2px;
		min-height: 0.5rem;
	}
	i.dot {
		display: inline-block;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		font-style: normal;
	}
	i.dot.class {
		background: var(--dot-class);
	}
	i.dot.extra {
		background: var(--dot-extra);
	}
	i.dot.skipped {
		background: var(--dot-skipped);
	}
	input[type='date'] {
		padding: 0.35rem 0.5rem;
		border: 1px solid #c9ced6;
		border-radius: 6px;
	}
</style>
```

**Note:** `stripVisible` uses `klass` from props; after save, parent must pass updated `class` so the strip re-renders. The `$effect` re-syncs inputs when `klass` changes.

- [ ] **Step 2: Wire `+page.svelte`**

1. Add `import SemesterMap from './SemesterMap.svelte';`
2. Add local state after `let { data }`:

```typescript
let classSnapshot = $state(data.class);

$effect(() => {
	classSnapshot = data.class;
});
```

3. Insert **between** the closing `</section>` of the first big card (the one ending after `{#if dupDates}`) and the `<section class="card">` for “Add session”:

```svelte
<SemesterMap
	class={classSnapshot}
	{lessons}
	onSemesterSaved={(c) => {
		classSnapshot = c;
	}}
/>
```

4. Ensure the first stats card still uses `data.class.name` (or switch to `classSnapshot.name` if you prefer one source — not required for this feature).

- [ ] **Step 3: Align skipped table badge with red (optional but recommended)**

In `src/routes/class/[classId]/+page.svelte` `<style>`, replace `.badge-skipped` with:

```css
.badge-skipped {
	background: #fce8e6;
	color: #c5221f;
}
```

This matches the spec’s **red** emphasis for skipped in the calendar legend.

- [ ] **Step 4: Run `check`**

Run:

```bash
bun run check
```

Expected: no new Svelte/TS errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/class/[classId]/SemesterMap.svelte src/routes/class/[classId]/+page.svelte
git commit -m "feat: semester map card with mini-month strip"
```

---

### Task 5: Product spec cross-link

**Files:**

- Modify: `docs/superpowers/specs/2026-04-20-lesson-planner-design.md`

- [ ] **Step 1: Add a short subsection**

After the `### Class` bullet list in `2026-04-20-lesson-planner-design.md`, add:

```markdown
- **`semesterStart` / `semesterEnd`**: optional inclusive `YYYY-MM-DD` bounds for the per-class **semester map** UI (see `docs/superpowers/specs/2026-04-21-semester-mini-calendars-design.md`). When unset, the map is hidden; lessons may still exist outside the configured range.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-20-lesson-planner-design.md
git commit -m "docs: link lesson planner spec to semester map fields"
```

---

## Plan self-review (vs design spec)

| Spec requirement | Task covering it |
|------------------|------------------|
| `ClassRow` nullable pair, `start ≤ end`, both null or both set | Task 1–3 |
| Dexie migration + backfill | Task 2 |
| `updateClass` rejects invalid; toast-friendly messages | Task 3 (`Error.message`), Task 4 (`showToast`) |
| Route receives fields via existing `getClass` load | Task 2 (types flow to layout data) |
| Semester card placement above Add session | Task 4 |
| Explicit save, helper when unset | Task 4 |
| Horizontal scroll, `aria-label`, Monday-first, 6×7, legend, skipped red | Task 4 |
| Out-of-range muted, no dots | Task 4 (`muted` + dots only when `inS`) |
| View-only cells | Task 4 (no links/buttons in cells) |
| Unique kind dots per day | Task 1 + Task 4 |
| Month title “April 2026” style | Task 1 `formatYearMonthHeading` + Task 4 |
| Pure logic unit tests | Task 1 |
| Lessons outside range unchanged in list | No list changes (implicit) |

**Placeholder scan:** none intentional; all code blocks are complete.

**Type consistency:** `ClassRow` always includes `semesterStart` / `semesterEnd` after Task 2; `SemesterMap` props use that shape.

---

## Plan complete

Saved to `docs/superpowers/plans/2026-04-21-semester-mini-calendars.md`.

**Execution options:**

1. **Subagent-driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration. **Required sub-skill:** `superpowers:subagent-driven-development`.

2. **Inline execution** — Run tasks in this session with checkpoints. **Required sub-skill:** `superpowers:executing-plans`.

Which approach do you want?
