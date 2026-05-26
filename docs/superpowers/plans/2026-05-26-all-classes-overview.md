# All-classes overview calendar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/overview` — a single month calendar showing which days have ≥2 lessons across all classes with configured semesters, with tap-to-open per-class counts.

**Architecture:** Pure aggregation and span logic live in `src/lib/logic/overviewCalendar.ts` (Vitest). Reuse `monthGridMondayFirst`, `isDateInSemester`, `compareIsoDate`, `listYearMonthsInRange`, `toUtcIsoCalendarDate` from `semesterCalendar.ts`. Loader fetches all classes from parent, batches lessons for included class ids, and `depends()` on each included class’s `classLessonsLoadKey` + `classMetaLoadKey` so overview refreshes when semesters or lessons change without editing every mutation site. UI is a route-level Svelte page with colocated `OverviewMonthGrid.svelte` and a native `<dialog>` for the detail panel.

**Tech Stack:** SvelteKit 2, Svelte 5, Dexie 4, Vitest, Bun.

**Spec:** `docs/superpowers/specs/2026-05-26-all-classes-overview-design.md`

---

## Scope check

Single subsystem (pure logic + one repo helper + one route + header link). One plan is sufficient.

---

## File map

| Path | Responsibility |
|------|----------------|
| `src/lib/logic/overviewCalendar.ts` | Span, included/excluded classes, day index, full-day check, default month, month in range |
| `src/lib/logic/overviewCalendar.test.ts` | Unit tests |
| `src/lib/repos/lessons.repo.ts` | `listLessonsForClassIds(classIds)` — single query + sort |
| `src/lib/repos/lessons.repo.test.ts` | Batch list test |
| `src/routes/overview/+page.ts` | Load classes (parent), lessons for included ids, expose serializable payload |
| `src/routes/overview/OverviewMonthGrid.svelte` | Month nav, 6×7 grid, full-day buttons, dialog |
| `src/routes/overview/+page.svelte` | Shell, empty states, wires grid + derived index |
| `src/routes/+layout.svelte` | Header link **Overview** → `/overview` with `data-sveltekit-preload-data="tap"` |
| `docs/superpowers/specs/2026-05-26-all-classes-overview-design.md` | Already written — no change unless copy tweaks during UI |

---

### Task 1: Pure `overviewCalendar` logic (TDD)

**Files:**

- Create: `src/lib/logic/overviewCalendar.ts`
- Create: `src/lib/logic/overviewCalendar.test.ts`
- Test: `src/lib/logic/overviewCalendar.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/logic/overviewCalendar.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { ClassRow, LessonRow } from '$lib/db/types';
import {
	overviewSpan,
	includedClasses,
	excludedClasses,
	isFullDay,
	buildOverviewDayIndex,
	countsForDate,
	defaultOverviewYearMonth,
	yearMonthInOverviewSpan,
	addYearMonth
} from './overviewCalendar';

const classA = (semester: { start: string; end: string } | null): ClassRow => ({
	id: 'a',
	name: 'Class A',
	totalHoursTarget: 40,
	requiredStudentLessonHours: 0,
	createdAt: 0,
	semesterStart: semester?.start ?? null,
	semesterEnd: semester?.end ?? null
});

describe('overviewCalendar', () => {
	it('overviewSpan returns min start and max end across configured classes', () => {
		const classes = [
			classA({ start: '2026-09-01', end: '2026-12-20' }),
			classA({ start: '2026-01-15', end: '2026-06-30' })
		];
		classes[1].id = 'b';
		expect(overviewSpan(classes)).toEqual({ start: '2026-01-15', end: '2026-12-20' });
	});

	it('overviewSpan is null when no class has both semester dates', () => {
		expect(overviewSpan([classA(null)])).toBeNull();
	});

	it('overviewSpan ignores classes without semester', () => {
		const without = classA(null);
		without.id = 'x';
		expect(
			overviewSpan([classA({ start: '2026-01-01', end: '2026-06-01' }), without])
		).toEqual({ start: '2026-01-01', end: '2026-06-01' });
	});

	it('includedClasses / excludedClasses partition by semester pair', () => {
		const with = classA({ start: '2026-01-01', end: '2026-06-01' });
		const without = classA(null);
		without.id = 'x';
		expect(includedClasses([with, without]).map((c) => c.id)).toEqual(['a']);
		expect(excludedClasses([with, without]).map((c) => c.id)).toEqual(['x']);
	});

	it('isFullDay is true at 2+', () => {
		expect(isFullDay(0)).toBe(false);
		expect(isFullDay(1)).toBe(false);
		expect(isFullDay(2)).toBe(true);
	});

	it('buildOverviewDayIndex counts lessons only inside each class semester', () => {
		const classes = [classA({ start: '2026-04-01', end: '2026-04-30' })];
		const lessons: LessonRow[] = [
			{
				id: '1',
				classId: 'a',
				date: '2026-03-31',
				durationHours: 2,
				title: 'Out',
				done: false,
				sessionKind: 'class'
			},
			{
				id: '2',
				classId: 'a',
				date: '2026-04-01',
				durationHours: 2,
				title: 'In1',
				done: false,
				sessionKind: 'class'
			},
			{
				id: '3',
				classId: 'a',
				date: '2026-04-01',
				durationHours: 2,
				title: 'In2',
				done: false,
				sessionKind: 'skipped'
			}
		];
		const index = buildOverviewDayIndex(classes, { a: lessons });
		expect(countsForDate(index, '2026-03-31')).toBeNull();
		const apr1 = countsForDate(index, '2026-04-01');
		expect(apr1?.total).toBe(2);
		expect(apr1?.byClass).toEqual([{ classId: 'a', className: 'Class A', count: 2 }]);
		expect(isFullDay(apr1!.total)).toBe(true);
	});

	it('buildOverviewDayIndex aggregates across two classes on same day', () => {
		const c1 = classA({ start: '2026-04-01', end: '2026-04-30' });
		const c2 = classA({ start: '2026-04-01', end: '2026-04-30' });
		c2.id = 'b';
		c2.name = 'Class B';
		const index = buildOverviewDayIndex([c1, c2], {
			a: [
				{
					id: '1',
					classId: 'a',
					date: '2026-04-10',
					durationHours: 2,
					title: 'A',
					done: false,
					sessionKind: 'class'
				}
			],
			b: [
				{
					id: '2',
					classId: 'b',
					date: '2026-04-10',
					durationHours: 2,
					title: 'B',
					done: false,
					sessionKind: 'class'
				}
			]
		});
		expect(countsForDate(index, '2026-04-10')?.total).toBe(2);
	});

	it('defaultOverviewYearMonth picks today month when in span', () => {
		expect(
			defaultOverviewYearMonth({ start: '2026-04-01', end: '2026-06-30' }, '2026-05-15')
		).toBe('2026-05');
	});

	it('defaultOverviewYearMonth picks first month when today outside span', () => {
		expect(
			defaultOverviewYearMonth({ start: '2026-04-01', end: '2026-06-30' }, '2026-01-01')
		).toBe('2026-04');
	});

	it('yearMonthInOverviewSpan and addYearMonth', () => {
		const span = { start: '2026-04-05', end: '2026-06-10' };
		expect(yearMonthInOverviewSpan('2026-03', span)).toBe(false);
		expect(yearMonthInOverviewSpan('2026-04', span)).toBe(true);
		expect(yearMonthInOverviewSpan('2026-07', span)).toBe(false);
		expect(addYearMonth('2026-04', 1)).toBe('2026-05');
		expect(addYearMonth('2026-12', 1)).toBe('2027-01');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/lib/logic/overviewCalendar.test.ts`
Expected: FAIL — cannot find module `./overviewCalendar`

- [ ] **Step 3: Implement `overviewCalendar.ts`**

Create `src/lib/logic/overviewCalendar.ts`:

```typescript
import type { ClassId, ClassRow, LessonRow } from '$lib/db/types';
import { isDateInSemester, listYearMonthsInRange } from '$lib/logic/semesterCalendar';

export type OverviewSpan = { start: string; end: string };

export type ClassDayCount = { classId: ClassId; className: string; count: number };

export type DayCounts = { total: number; byClass: ClassDayCount[] };

export type OverviewDayIndex = Map<string, DayCounts>;

export function hasConfiguredSemester(c: ClassRow): boolean {
	return c.semesterStart != null && c.semesterEnd != null;
}

export function includedClasses(classes: ClassRow[]): ClassRow[] {
	return classes.filter(hasConfiguredSemester);
}

export function excludedClasses(classes: ClassRow[]): ClassRow[] {
	return classes.filter((c) => !hasConfiguredSemester(c));
}

export function overviewSpan(classes: ClassRow[]): OverviewSpan | null {
	const included = includedClasses(classes);
	if (included.length === 0) return null;
	let start = included[0].semesterStart!;
	let end = included[0].semesterEnd!;
	for (const c of included.slice(1)) {
		if (c.semesterStart! < start) start = c.semesterStart!;
		if (c.semesterEnd! > end) end = c.semesterEnd!;
	}
	return { start, end };
}

export function isFullDay(total: number): boolean {
	return total >= 2;
}

export function buildOverviewDayIndex(
	included: ClassRow[],
	lessonsByClassId: Record<ClassId, LessonRow[]>
): OverviewDayIndex {
	const index: OverviewDayIndex = new Map();
	for (const c of included) {
		const start = c.semesterStart!;
		const end = c.semesterEnd!;
		for (const lesson of lessonsByClassId[c.id] ?? []) {
			if (!isDateInSemester(lesson.date, start, end)) continue;
			const existing = index.get(lesson.date);
			if (!existing) {
				index.set(lesson.date, {
					total: 1,
					byClass: [{ classId: c.id, className: c.name, count: 1 }]
				});
				continue;
			}
			existing.total += 1;
			const row = existing.byClass.find((r) => r.classId === c.id);
			if (row) row.count += 1;
			else existing.byClass.push({ classId: c.id, className: c.name, count: 1 });
		}
	}
	for (const counts of index.values()) {
		counts.byClass.sort((a, b) => a.className.localeCompare(b.className));
	}
	return index;
}

export function countsForDate(index: OverviewDayIndex, isoDate: string): DayCounts | null {
	return index.get(isoDate) ?? null;
}

export function defaultOverviewYearMonth(span: OverviewSpan, todayIso: string): string {
	const months = listYearMonthsInRange(span.start, span.end);
	const todayYm = todayIso.slice(0, 7);
	if (months.includes(todayYm)) return todayYm;
	return months[0]!;
}

export function addYearMonth(yearMonth: string, delta: number): string {
	const [y, m] = yearMonth.split('-').map(Number);
	const d = new Date(Date.UTC(y, m - 1 + delta, 1));
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** True if the calendar month intersects [span.start, span.end] inclusively. */
export function yearMonthInOverviewSpan(yearMonth: string, span: OverviewSpan): boolean {
	const months = listYearMonthsInRange(span.start, span.end);
	return months.includes(yearMonth);
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test -- src/lib/logic/overviewCalendar.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/logic/overviewCalendar.ts src/lib/logic/overviewCalendar.test.ts
git commit -m "feat(overview): add pure calendar aggregation helpers"
```

---

### Task 2: Batch lessons repository helper

**Files:**

- Modify: `src/lib/repos/lessons.repo.ts`
- Modify: `src/lib/repos/lessons.repo.test.ts`

- [ ] **Step 1: Write failing test**

Add to `src/lib/repos/lessons.repo.test.ts`:

```typescript
import { listLessonsForClassIds } from './lessons.repo';

// inside describe, after existing tests:
it('listLessonsForClassIds returns lessons grouped by classId', async () => {
	const c1 = await createClass({ name: 'One', totalHoursTarget: 10 });
	const c2 = await createClass({ name: 'Two', totalHoursTarget: 10 });
	await createLesson({ classId: c1.id, date: '2026-04-01', durationHours: 2, title: 'A' });
	await createLesson({ classId: c2.id, date: '2026-04-02', durationHours: 2, title: 'B' });
	const map = await listLessonsForClassIds([c1.id, c2.id]);
	expect(map[c1.id]).toHaveLength(1);
	expect(map[c2.id]).toHaveLength(1);
	expect(map[c1.id]![0]!.date).toBe('2026-04-01');
});

it('listLessonsForClassIds returns empty object for empty ids', async () => {
	expect(await listLessonsForClassIds([])).toEqual({});
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `bun run test -- src/lib/repos/lessons.repo.test.ts`

- [ ] **Step 3: Implement**

Add to `src/lib/repos/lessons.repo.ts`:

```typescript
export async function listLessonsForClassIds(
	classIds: ClassId[]
): Promise<Record<ClassId, LessonRow[]>> {
	if (classIds.length === 0) return {};
	const rows = await db.lessons.where('classId').anyOf(classIds).toArray();
	rows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
	const out: Record<ClassId, LessonRow[]> = {};
	for (const id of classIds) out[id] = [];
	for (const row of rows) {
		(out[row.classId] ??= []).push(row);
	}
	return out;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `bun run test -- src/lib/repos/lessons.repo.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/repos/lessons.repo.ts src/lib/repos/lessons.repo.test.ts
git commit -m "feat(overview): batch list lessons by class ids"
```

---

### Task 3: Overview route loader

**Files:**

- Create: `src/routes/overview/+page.ts`

- [ ] **Step 1: Create loader**

Create `src/routes/overview/+page.ts`:

```typescript
import type { PageLoad } from './$types';
import { classLessonsLoadKey, classMetaLoadKey } from '$lib/kit/loadKeys';
import {
	excludedClasses,
	includedClasses,
	overviewSpan,
	buildOverviewDayIndex
} from '$lib/logic/overviewCalendar';
import { listLessonsForClassIds } from '$lib/repos/lessons.repo';

export const load: PageLoad = async ({ parent, depends }) => {
	const { classes } = await parent();
	const included = includedClasses(classes);
	const excluded = excludedClasses(classes);
	for (const c of included) {
		depends(classMetaLoadKey(c.id));
		depends(classLessonsLoadKey(c.id));
	}
	const span = overviewSpan(classes);
	if (!span) {
		return { classes, included, excluded, span: null, dayIndex: null };
	}
	const lessonsByClassId = await listLessonsForClassIds(included.map((c) => c.id));
	const dayIndex = buildOverviewDayIndex(included, lessonsByClassId);
	return { classes, included, excluded, span, dayIndex };
};
```

Note: `dayIndex` is a `Map` — SvelteKit serializes load data; **Maps do not serialize**. Convert to a plain object or array in the loader before return:

```typescript
const dayIndexEntries = [...buildOverviewDayIndex(included, lessonsByClassId).entries()];
return { ..., dayIndexEntries };
```

Update Step 1 implementation to return `dayIndexEntries: [string, DayCounts][]` instead of `dayIndex`.

- [ ] **Step 2: Manual smoke**

Run: `bun run dev`, navigate to `/overview` (will 404 until Task 4). Skip until page exists.

- [ ] **Step 3: Commit**

```bash
git add src/routes/overview/+page.ts
git commit -m "feat(overview): add route loader with lesson aggregation"
```

---

### Task 4: Overview UI (`+page.svelte` + `OverviewMonthGrid.svelte`)

**Files:**

- Create: `src/routes/overview/+page.svelte`
- Create: `src/routes/overview/OverviewMonthGrid.svelte`

- [ ] **Step 1: Create `+page.svelte` shell**

```svelte
<script lang="ts">
	import type { PageData } from './$types';
	import OverviewMonthGrid from './OverviewMonthGrid.svelte';
	import { formatIsoDate } from '$lib/logic/dateFormat';
	import {
		defaultOverviewYearMonth,
		type DayCounts,
		type OverviewSpan
	} from '$lib/logic/overviewCalendar';
	import { toUtcIsoCalendarDate } from '$lib/logic/semesterCalendar';

	let { data }: { data: PageData } = $props();

	const span = $derived(data.span);
	const excluded = $derived(data.excluded);
	const index = $derived(new Map<string, DayCounts>(data.dayIndexEntries ?? []));

	let yearMonth = $state('');
	$effect(() => {
		if (!span) return;
		if (!yearMonth || !data.span) {
			yearMonth = defaultOverviewYearMonth(span, toUtcIsoCalendarDate(new Date()));
		}
	});
</script>

{#if data.classes.length === 0}
	<section class="card">
		<h1>Lesson overview</h1>
		<p>Use <strong>Create class</strong> in the header to add your first class.</p>
	</section>
{:else if !span}
	<section class="card">
		<h1>Lesson overview</h1>
		<p class="muted">Set semester start and end on each class to see the overview.</p>
		<ul class="class-links">
			{#each data.classes as c (c.id)}
				<li><a href="/class/{c.id}">{c.name}</a></li>
			{/each}
		</ul>
	</section>
{:else}
	<section class="card">
		<h1>Lesson overview</h1>
		<p class="muted">Days with at least 2 lessons across your classes</p>
		<p class="range">From {formatIsoDate(span.start)} to {formatIsoDate(span.end)}</p>
		{#if excluded.length > 0}
			<p class="note">
				{excluded.length} class{excluded.length === 1 ? '' : 'es'} without a semester not included:
				{excluded.map((c) => c.name).join(', ')}
			</p>
		{/if}
		<OverviewMonthGrid {span} {index} bind:yearMonth />
	</section>
{/if}

<style>
	.card {
		background: #fff;
		padding: 1.5rem;
		border-radius: 8px;
		border: 1px solid #e2e5eb;
	}
	.muted {
		color: #666;
	}
	.range {
		font-size: 0.9rem;
		margin: 0.25rem 0 1rem;
	}
	.note {
		font-size: 0.85rem;
		color: #5c4a1a;
		background: #fff8e6;
		border: 1px solid #f0d080;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
	}
	.class-links {
		margin: 0.75rem 0 0;
		padding-left: 1.25rem;
	}
</style>
```

Fix loader return type in Task 3 to use `dayIndexEntries`.

- [ ] **Step 2: Create `OverviewMonthGrid.svelte`**

Key behaviors:

- Props: `span: OverviewSpan`, `index: Map<string, DayCounts>`, `yearMonth` bindable.
- Nav: `‹` / `›` buttons; disable when `!yearMonthInOverviewSpan(addYearMonth(yearMonth, ±1), span)`.
- Grid: `monthGridMondayFirst(yearMonth)`, weekdays `Mon`…`Sun`.
- Cell in global span: `isDateInSemester(cell.isoDate, span.start, span.end)`.
- Muted if `!inGlobalSpan`.
- Full if `counts = index.get(isoDate)` and `isFullDay(counts.total)` — render `<button type="button">` with class `full`, show `2+` badge.
- Today: `cell.isoDate === toUtcIsoCalendarDate(new Date())`, `aria-current="date"`.
- Legend: Normal / Full (2+ lessons).
- Dialog: `let dialogEl: HTMLDialogElement`; on full-day click `dialogEl.showModal()`; content = formatted date, total, list `byClass` with `<a href="/class/{id}">Go to class</a>`; `onclose` / Esc handled by dialog.

CSS (match spec):

```css
.cell.full {
	background: #fff7ed;
	border: 1px solid #fdba74;
}
.cell.muted {
	opacity: 0.45;
}
.badge-2plus {
	font-size: 0.65rem;
	font-weight: 600;
}
```

Use `formatYearMonthHeading` from `$lib/logic/dateFormat` for nav title.

- [ ] **Step 3: Run checks**

Run: `bun run check`
Run: `bun run test`
Expected: PASS

- [ ] **Step 4: Manual UAT**

1. Two classes, both semesters set, 2 lessons same day → day amber, tap shows breakdown.
2. One lesson → neutral, not a button.
3. Class without semester → note shown, excluded from counts.
4. Month nav stops at span edges.

- [ ] **Step 5: Commit**

```bash
git add src/routes/overview/
git commit -m "feat(overview): add month calendar UI and detail dialog"
```

---

### Task 5: Header navigation link

**Files:**

- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Add Overview link**

Inside `<header class="bar">`, after brand (or before class switcher when classes exist):

```svelte
<a
	href="/overview"
	class="nav-overview"
	class:active={page.url.pathname === '/overview'}
	data-sveltekit-preload-data="tap"
>
	Overview
</a>
```

Style `.nav-overview` like subdued text link; `.active` matches sub-nav weight if on overview.

- [ ] **Step 2: Smoke**

From `/class/[id]`, click Overview; back via class switcher.

- [ ] **Step 3: Commit**

```bash
git add src/routes/+layout.svelte
git commit -m "feat(overview): add header link to overview page"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full test suite**

Run: `bun run test`
Expected: all PASS

- [ ] **Step 2: Typecheck**

Run: `bun run check`
Expected: 0 errors

- [ ] **Step 3: Spec cross-check**

| Spec requirement | Covered by |
|------------------|------------|
| `/overview` route | Task 3–4 |
| ≥2 lessons = full | Task 1 `isFullDay` |
| Per-class semester filter | Task 1 `buildOverviewDayIndex` |
| Union span | Task 1 `overviewSpan` |
| Month navigation | Task 4 grid |
| Tap → per-class summary | Task 4 dialog |
| Excluded classes note | Task 4 `+page.svelte` |
| Header link | Task 5 |
| No schema change | (none) |

---

## Plan self-review

- **Spec coverage:** All v1 requirements mapped in Task 6 table.
- **Placeholder scan:** None.
- **Type consistency:** `dayIndexEntries` serialized in loader; page rebuilds `Map` — consistent across Task 3–4.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-26-all-classes-overview.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement tasks in this session with checkpoints

Which approach do you want?
