# Session completion criteria — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace boolean done + screenshot ⚠ with a pluggable criteria registry (note, screenshot, attendance), per-criterion Lucide icons or a single green ✓, and screenshot preview from the Actions column — with `presenze.csv` parsed via d3-dsv and validated with Zod.

**Architecture:** Extend `enrichClassLessonsFromFolder` to read `presenze.csv` into `Map<stem, boolean>`. Pure `matchNotesToLessons` calls `evaluateSessionCriteria` from `sessionCompletion/criteria.ts` to set `criteria[]` and derived `done`. CSV syntax uses `d3-dsv`; domain types use Zod in `src/lib/schemas/`. UI renders `SESSION_CRITERIA` icons from `@lucide/svelte`.

**Tech Stack:** SvelteKit 2, Svelte 5, Dexie 4, `@lucide/svelte`, `d3-dsv`, Zod 4, File System Access API, Vitest, Bun

**Spec:** `docs/superpowers/specs/2026-06-02-session-completion-criteria-design.md`

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add `@lucide/svelte`, `d3-dsv`; dev `@types/d3-dsv` |
| `src/lib/csv/parseGrid.ts` | Create | `stripBom`, `parseCsvGridRaw` |
| `src/lib/schemas/csv.ts` | Create | `csvGridSchema`, `parseCsvGrid` |
| `src/lib/schemas/csv.test.ts` | Create | Grid + BOM tests |
| `src/lib/schemas/presenze.ts` | Create | `buildPresenzeStemIndex`, `loadPresenzeStemIndex` |
| `src/lib/schemas/presenze.test.ts` | Create | Stem index tests |
| `src/lib/schemas/rosterCsv.ts` | Create | `importNamesFromCsvGrid` |
| `src/lib/logic/rosterImport.ts` | Modify | Delegate CSV to `parseCsvGrid` + roster schema |
| `src/lib/logic/rosterImport.test.ts` | Modify | Add quoted-comma test |
| `src/lib/sessionCompletion/types.ts` | Create | `CriterionDef`, `CriterionStatus`, `CompletionSlice` |
| `src/lib/sessionCompletion/criteria.ts` | Create | `SESSION_CRITERIA`, `evaluateSessionCriteria`, `allCriteriaSatisfied` |
| `src/lib/sessionCompletion/criteria.test.ts` | Create | Evaluator tests |
| `src/lib/sessionCompletion/criterionTooltip.ts` | Create | Tooltip strings per criterion |
| `src/lib/persistence/classFolder.ts` | Modify | `readOptionalTextFileInRoot` |
| `src/lib/lessonNotes/types.ts` | Modify | `criteria`, remove `screenshotMissing`; add `presenze_parse_error` |
| `src/lib/lessonNotes/match.ts` | Modify | Criteria + attendance in `done` |
| `src/lib/lessonNotes/match.test.ts` | Modify | Replace `screenshotMissing` tests with `criteria` |
| `src/lib/lessonNotes/enrich.ts` | Modify | Load presenze, pass to match |
| `src/lib/lessonNotes/doneTooltip.ts` | Delete | Replaced by `criterionTooltip.ts` |
| `src/routes/class/[classId]/+page.svelte` | Modify | Done icons; Actions preview button |
| `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte` | Modify | Criteria checklist |
| `src/routes/class/[classId]/SemesterMap.svelte` | Modify | Legend copy for new done rule |
| `README.md` | Modify | `presenze.csv`, criteria, done column |

---

### Task 1: Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
bun add @lucide/svelte d3-dsv
bun add -d @types/d3-dsv
```

- [ ] **Step 2: Verify check**

Run: `bun run check`  
Expected: PASS (no code changes yet)

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add @lucide/svelte and d3-dsv for session completion"
```

---

### Task 2: CSV grid parsing (d3-dsv + Zod)

**Files:**
- Create: `src/lib/csv/parseGrid.ts`
- Create: `src/lib/schemas/csv.ts`
- Create: `src/lib/schemas/csv.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/schemas/csv.test.ts
import { describe, expect, it } from 'vitest';
import { parseCsvGrid } from './csv';

describe('parseCsvGrid', () => {
	it('parses simple grid', () => {
		const g = parseCsvGrid('a,b\n1,2');
		expect(g).toEqual([
			['a', 'b'],
			['1', '2']
		]);
	});

	it('handles quoted commas', () => {
		const g = parseCsvGrid('name,09\n"Rossi, Mario",P');
		expect(g[1][0]).toBe('Rossi, Mario');
		expect(g[1][1]).toBe('P');
	});

	it('strips UTF-8 BOM from first header', () => {
		const g = parseCsvGrid('\uFEFFname,09\nAlice,P');
		expect(g[0][0]).toBe('name');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/schemas/csv.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
// src/lib/csv/parseGrid.ts
import { csvParseRows } from 'd3-dsv';

export function stripBom(text: string): string {
	return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseCsvGridRaw(text: string): string[][] {
	return csvParseRows(stripBom(text));
}
```

```ts
// src/lib/schemas/csv.ts
import { z } from 'zod';
import { parseCsvGridRaw } from '$lib/csv/parseGrid';

export const csvGridSchema = z.array(z.array(z.string())).min(1, 'empty csv');

export type CsvGrid = z.infer<typeof csvGridSchema>;

export function parseCsvGrid(text: string): CsvGrid {
	return csvGridSchema.parse(parseCsvGridRaw(text));
}

export function safeParseCsvGrid(text: string): { ok: true; grid: CsvGrid } | { ok: false } {
	const parsed = csvGridSchema.safeParse(parseCsvGridRaw(text));
	if (!parsed.success) return { ok: false };
	return { ok: true, grid: parsed.data };
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test src/lib/schemas/csv.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv/parseGrid.ts src/lib/schemas/csv.ts src/lib/schemas/csv.test.ts
git commit -m "feat(csv): parse CSV grids with d3-dsv and Zod"
```

---

### Task 3: Presenze stem index (Zod + domain logic)

**Files:**
- Create: `src/lib/schemas/presenze.ts`
- Create: `src/lib/schemas/presenze.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/schemas/presenze.test.ts
import { describe, expect, it } from 'vitest';
import { buildPresenzeStemIndex, loadPresenzeStemIndex } from './presenze';

describe('buildPresenzeStemIndex', () => {
	it('marks stem true when column has a non-empty cell', () => {
		const map = buildPresenzeStemIndex([
			['name', '09', '10'],
			['Alice', 'P', ''],
			['Bob', '', '']
		]);
		expect(map.get('09')).toBe(true);
		expect(map.get('10')).toBe(false);
	});

	it('ignores column 0 as student names', () => {
		const map = buildPresenzeStemIndex([
			['name', '09'],
			['Alice', 'P']
		]);
		expect(map.has('name')).toBe(false);
		expect(map.get('09')).toBe(true);
	});
});

describe('loadPresenzeStemIndex', () => {
	it('returns empty map for invalid csv', () => {
		expect(loadPresenzeStemIndex('').size).toBe(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/schemas/presenze.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement**

```ts
// src/lib/schemas/presenze.ts
import type { CsvGrid } from './csv';
import { safeParseCsvGrid } from './csv';

export function buildPresenzeStemIndex(grid: CsvGrid): Map<string, boolean> {
	const headers = grid[0].map((h) => h.trim());
	const map = new Map<string, boolean>();
	for (let col = 1; col < headers.length; col++) {
		const stem = headers[col];
		if (!stem) continue;
		let hasData = false;
		for (let row = 1; row < grid.length; row++) {
			const cell = (grid[row][col] ?? '').trim();
			if (cell) {
				hasData = true;
				break;
			}
		}
		map.set(stem, hasData);
	}
	return map;
}

export function loadPresenzeStemIndex(text: string): Map<string, boolean> {
	const parsed = safeParseCsvGrid(text);
	if (!parsed.ok) return new Map();
	return buildPresenzeStemIndex(parsed.grid);
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test src/lib/schemas/presenze.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/presenze.ts src/lib/schemas/presenze.test.ts
git commit -m "feat(presenze): build stem index from CSV grid with Zod"
```

---

### Task 4: Refactor roster CSV import to shared parser

**Files:**
- Create: `src/lib/schemas/rosterCsv.ts`
- Modify: `src/lib/logic/rosterImport.ts`
- Modify: `src/lib/logic/rosterImport.test.ts`

- [ ] **Step 1: Add quoted-comma failing test**

```ts
// append to rosterImport.test.ts
	it('parseCsvNames handles quoted commas in first column', () => {
		const r = parseCsvNames('name,extra\n"Rossi, Mario",x\nBob,y');
		expect(r.names).toEqual(['Rossi, Mario', 'Bob']);
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/logic/rosterImport.test.ts`  
Expected: FAIL (splits on first comma inside quotes)

- [ ] **Step 3: Implement rosterCsv + wire rosterImport**

```ts
// src/lib/schemas/rosterCsv.ts
import type { CsvGrid } from './csv';
import type { ImportNamesResult } from '$lib/logic/rosterImport';

export function importNamesFromCsvGrid(grid: CsvGrid): ImportNamesResult {
	if (grid.length === 0) return { names: [], skipped: 0 };
	let start = 0;
	const head = grid[0][0]?.trim().toLowerCase() ?? '';
	if (head === 'name') start = 1;
	const names: string[] = [];
	let skipped = 0;
	for (let i = start; i < grid.length; i++) {
		const cell = (grid[i][0] ?? '').trim();
		if (cell) names.push(cell);
		else skipped++;
	}
	return { names, skipped };
}
```

```ts
// src/lib/logic/rosterImport.ts — replace parseCsvNames body
import { parseCsvGrid } from '$lib/schemas/csv';
import { importNamesFromCsvGrid } from '$lib/schemas/rosterCsv';

export function parseCsvNames(content: string): ImportNamesResult {
	return importNamesFromCsvGrid(parseCsvGrid(content));
}
```

Remove `firstCell` helper (no longer used).

- [ ] **Step 4: Run tests**

Run: `bun run test src/lib/logic/rosterImport.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/rosterCsv.ts src/lib/logic/rosterImport.ts src/lib/logic/rosterImport.test.ts
git commit -m "refactor(roster): parse CSV via d3-dsv and Zod"
```

---

### Task 5: Session completion registry and evaluators

**Files:**
- Create: `src/lib/sessionCompletion/types.ts`
- Create: `src/lib/sessionCompletion/criteria.ts`
- Create: `src/lib/sessionCompletion/criteria.test.ts`
- Create: `src/lib/sessionCompletion/criterionTooltip.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/sessionCompletion/criteria.test.ts
import { describe, expect, it } from 'vitest';
import {
	evaluateSessionCriteria,
	allCriteriaSatisfied,
	SESSION_CRITERIA
} from './criteria';
import type { LessonRow } from '$lib/db/types';

const lesson = (o: Partial<LessonRow> & Pick<LessonRow, 'sessionKind' | 'date'>): LessonRow => ({
	id: '1',
	classId: 'c1',
	durationHours: 5,
	title: 'L',
	done: false,
	...o
});

describe('evaluateSessionCriteria', () => {
	it('class past: three criteria when note+png+presenze', () => {
		const statuses = evaluateSessionCriteria({
			lesson: lesson({ sessionKind: 'class', date: '2026-03-09' }),
			todayIso: '2026-06-01',
			hasNote: true,
			hasScreenshot: true,
			stem: '09',
			presenzeByStem: new Map([['09', true]])
		});
		expect(statuses).toHaveLength(3);
		expect(allCriteriaSatisfied(statuses)).toBe(true);
	});

	it('extra: no attendance criterion', () => {
		const statuses = evaluateSessionCriteria({
			lesson: lesson({ sessionKind: 'extra', date: '2026-03-09' }),
			todayIso: '2026-06-01',
			hasNote: true,
			hasScreenshot: true,
			stem: '02',
			presenzeByStem: new Map()
		});
		expect(statuses.map((s) => s.id)).toEqual(['note', 'screenshot']);
		expect(allCriteriaSatisfied(statuses)).toBe(true);
	});

	it('future: returns empty (no criteria UI)', () => {
		const statuses = evaluateSessionCriteria({
			lesson: lesson({ sessionKind: 'class', date: '2026-12-01' }),
			todayIso: '2026-06-01',
			hasNote: true,
			hasScreenshot: true,
			stem: '09',
			presenzeByStem: new Map([['09', true]])
		});
		expect(statuses).toEqual([]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/sessionCompletion/criteria.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement**

```ts
// src/lib/sessionCompletion/types.ts
import type { Icon } from '@lucide/svelte';
import type { LessonSessionKind } from '$lib/db/types';

export type CriterionStatus = { id: string; satisfied: boolean };

export type CriterionDef = {
	id: string;
	label: string;
	icon: typeof Icon;
	appliesTo: (kind: LessonSessionKind) => boolean;
};

export type EvaluateInput = {
	lesson: { sessionKind: LessonSessionKind; date: string };
	todayIso: string;
	hasNote: boolean;
	hasScreenshot: boolean;
	stem: string | null;
	presenzeByStem: Map<string, boolean>;
};
```

```ts
// src/lib/sessionCompletion/criteria.ts
import { FileText, Image, Users } from '@lucide/svelte';
import type { CriterionDef, CriterionStatus, EvaluateInput } from './types';

export const SESSION_CRITERIA: CriterionDef[] = [
	{
		id: 'note',
		label: 'Lesson note',
		icon: FileText,
		appliesTo: (k) => k === 'class' || k === 'extra'
	},
	{
		id: 'screenshot',
		label: 'Screenshot',
		icon: Image,
		appliesTo: (k) => k === 'class' || k === 'extra'
	},
	{
		id: 'attendance',
		label: 'Attendance',
		icon: Users,
		appliesTo: (k) => k === 'class'
	}
];

function isPast(dateIso: string, todayIso: string): boolean {
	return dateIso <= todayIso;
}

export function evaluateSessionCriteria(input: EvaluateInput): CriterionStatus[] {
	const { lesson, todayIso, hasNote, hasScreenshot, stem, presenzeByStem } = input;
	if (lesson.sessionKind === 'skipped' || !isPast(lesson.date, todayIso)) return [];

	const hasAttendance =
		stem !== null && presenzeByStem.get(stem) === true;

	return SESSION_CRITERIA.filter((c) => c.appliesTo(lesson.sessionKind)).map((c) => {
		let satisfied = false;
		if (c.id === 'note') satisfied = hasNote;
		else if (c.id === 'screenshot') satisfied = hasScreenshot;
		else if (c.id === 'attendance') satisfied = hasAttendance;
		return { id: c.id, satisfied };
	});
}

export function allCriteriaSatisfied(statuses: CriterionStatus[]): boolean {
	return statuses.length > 0 && statuses.every((s) => s.satisfied);
}
```

```ts
// src/lib/sessionCompletion/criterionTooltip.ts
import type { EnrichedLesson } from '$lib/lessonNotes/types';
import { screenshotFileNameForNote, screenshotPathLabel } from '$lib/lessonNotes/screenshot';
import { SESSION_CRITERIA } from './criteria';

export function criterionTooltip(lesson: EnrichedLesson, criterionId: string): string {
	const def = SESSION_CRITERIA.find((c) => c.id === criterionId);
	if (!def) return '';
	const status = lesson.criteria?.find((c) => c.id === criterionId);
	const state = status?.satisfied ? 'present' : 'missing';
	const stem = lesson.matchedNote
		? lesson.matchedNote.fileName.replace(/\.md$/i, '')
		: null;

	if (criterionId === 'note') {
		if (!lesson.matchedNote) return `${def.label}: missing (no note for this date)`;
		return `${def.label}: ${state} (${lesson.matchedNote.folder}/${lesson.matchedNote.fileName})`;
	}
	if (criterionId === 'screenshot') {
		if (!lesson.matchedNote) return `${def.label}: missing (no note for this date)`;
		const png = screenshotFileNameForNote(lesson.matchedNote.fileName);
		if (!png) return `${def.label}: missing`;
		return `${def.label}: ${state} (${screenshotPathLabel(lesson.matchedNote.folder, png)})`;
	}
	if (criterionId === 'attendance') {
		if (!stem) return `${def.label}: missing (no note stem)`;
		return `${def.label}: ${state} (presenze.csv column ${stem})`;
	}
	return `${def.label}: ${state}`;
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test src/lib/sessionCompletion/criteria.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/sessionCompletion/
git commit -m "feat(sessionCompletion): criteria registry and evaluators"
```

---

### Task 6: Enrich pipeline — presenze file + match integration

**Files:**
- Modify: `src/lib/persistence/classFolder.ts`
- Modify: `src/lib/lessonNotes/types.ts`
- Modify: `src/lib/lessonNotes/match.ts`
- Modify: `src/lib/lessonNotes/match.test.ts`
- Modify: `src/lib/lessonNotes/enrich.ts`
- Delete: `src/lib/lessonNotes/doneTooltip.ts`

- [ ] **Step 1: Add `readOptionalTextFileInRoot`**

```ts
// classFolder.ts
export const PRESENZE_FILE_NAME = 'presenze.csv';

export async function readOptionalTextFileInRoot(
	root: FileSystemDirectoryHandle,
	fileName: string
): Promise<string | null> {
	try {
		const fh = await root.getFileHandle(fileName);
		return await (await fh.getFile()).text();
	} catch {
		return null;
	}
}
```

- [ ] **Step 2: Extend types — `criteria`, warning code; remove `screenshotMissing`**

```ts
// types.ts — LessonNoteWarningCode add:
| 'presenze_parse_error';

// EnrichedLesson:
criteria?: CriterionStatus[]; // import from sessionCompletion/types
// remove screenshotMissing?: boolean;
```

- [ ] **Step 3: Update match.ts**

Extend `MatchContext`:

```ts
export type MatchContext = {
	todayIso: string;
	screenshots: ScreenshotIndex;
	presenzeByStem: Map<string, boolean>;
};
```

In lesson map callback (after note/png resolution):

```ts
import { evaluateSessionCriteria, allCriteriaSatisfied } from '$lib/sessionCompletion/criteria';

const stem = note ? note.fileName.replace(/\.md$/i, '') : null;
const criteria = evaluateSessionCriteria({
	lesson,
	todayIso: ctx.todayIso,
	hasNote: notes.length > 0,
	hasScreenshot: hasPng,
	stem,
	presenzeByStem: ctx.presenzeByStem
});
row.criteria = criteria.length > 0 ? criteria : undefined;
row.done = allCriteriaSatisfied(criteria);
```

Remove all `screenshotMissing` assignments. Past sessions without notes: `criteria` with all false (not empty) — adjust `evaluateSessionCriteria` if tests expect icons for past empty note: **past non-skipped always returns criteria array** (spec: show muted icons).

Update `evaluateSessionCriteria`: only return `[]` for future or skipped (not for past missing note).

- [ ] **Step 4: Update match tests**

Replace `screenshotMissing` expectations with `criteria` checks, e.g.:

```ts
expect(out[0].criteria?.find((c) => c.id === 'screenshot')?.satisfied).toBe(false);
```

Add class test with presenze:

```ts
it('class done requires presenze column with data', () => {
	const { lessons: out } = match(
		[lesson({ id: '1', date: '2026-03-09', sessionKind: 'class' })],
		[{ folder: 'lezioni', fileName: '09.md', dateIso: '2026-03-09', durationHours: 5 }],
		[],
		{ lezioni: new Set(['09-screen.png']), extra: new Set() },
		{ presenzeByStem: new Map([['09', true]]) }
	);
	expect(out[0].done).toBe(true);
});

it('class not done without presenze data', () => {
	// same but presenzeByStem: new Map() or ['09', false]
	expect(out[0].done).toBe(false);
});
```

Update `match()` helper to accept optional `presenzeByStem`.

- [ ] **Step 5: Update enrich.ts**

```ts
import { loadPresenzeStemIndex } from '$lib/schemas/presenze';
import { readOptionalTextFileInRoot, PRESENZE_FILE_NAME } from '$lib/persistence/classFolder';
import { safeParseCsvGrid } from '$lib/schemas/csv';

// after permission check:
const presenzeText = await readOptionalTextFileInRoot(handle, PRESENZE_FILE_NAME);
let presenzeByStem = new Map<string, boolean>();
const warnings: LessonNoteWarning[] = [];
if (presenzeText !== null) {
	const safe = safeParseCsvGrid(presenzeText);
	if (!safe.ok) {
		warnings.push({
			code: 'presenze_parse_error',
			message: 'Could not parse presenze.csv'
		});
	} else {
		presenzeByStem = buildPresenzeStemIndex(safe.grid);
	}
}
// pass presenzeByStem into matchNotesToLessons; merge warnings
```

- [ ] **Step 6: Delete doneTooltip.ts; fix imports** (grep for `doneColumnTooltip`)

- [ ] **Step 7: Run tests**

Run: `bun run test src/lib/lessonNotes/match.test.ts src/lib/lessonNotes/`  
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/persistence/classFolder.ts src/lib/lessonNotes/ src/lib/schemas/presenze.ts
git rm src/lib/lessonNotes/doneTooltip.ts 2>/dev/null || true
git commit -m "feat(lessonNotes): criteria-based done with presenze.csv"
```

---

### Task 7: Sessions table UI — Done icons + Actions preview

**Files:**
- Modify: `src/routes/class/[classId]/+page.svelte`

- [ ] **Step 1: Replace Done column**

Import `SESSION_CRITERIA`, `criterionTooltip` from sessionCompletion. Remove `doneColumnTooltip` import.

For past non-skipped lessons with `lesson.criteria`:

```svelte
{#if lesson.sessionKind === 'skipped' || lesson.date > data.todayIso}
	<span class="muted">—</span>
{:else if !data.notesScanned}
	<span class="muted">—</span>
{:else if lesson.done}
	<span class="done-yes" title="All complete">✓</span>
	{#if lesson.hoursWarning}
		<span class="warn-icon" title="...">⚠</span>
	{/if}
{:else if lesson.criteria}
	<span class="criteria-icons">
		{#each SESSION_CRITERIA.filter((c) => c.appliesTo(lesson.sessionKind)) as def}
			{@const st = lesson.criteria?.find((c) => c.id === def.id)}
			{@const Icon = def.icon}
			<span
				class="criterion-icon"
				class:satisfied={st?.satisfied}
				title={criterionTooltip(lesson, def.id)}
				aria-label={criterionTooltip(lesson, def.id)}
			>
				<Icon size={16} />
			</span>
		{/each}
	</span>
	{#if lesson.hoursWarning}
		<span class="warn-icon" title="...">⚠</span>
	{/if}
{:else}
	<span class="muted">—</span>
{/if}
```

Add CSS:

```css
.criterion-icon {
	color: var(--muted);
}
.criterion-icon.satisfied {
	color: var(--primary);
}
.criteria-icons {
	display: inline-flex;
	gap: 0.35rem;
	align-items: center;
}
```

Pass `todayIso` from `+page.ts` load if not already available (derive from `toUtcIsoCalendarDate` in page or data).

- [ ] **Step 2: Move screenshot toggle to Actions**

Remove from `<tr>`: `onclick`, `class:row-expandable`, `class:row-expanded`, `aria-expanded`.

In `.actions` cell, when `lesson.screenshotRef`:

```svelte
<button
	type="button"
	class="link icon-btn"
	aria-label="Show screenshot"
	aria-expanded={expanded.has(lesson.id)}
	onclick={() => toggleExpand(lesson)}
>
	<Image size={16} />
</button>
```

Import `Image` from `@lucide/svelte` (preview control; distinct from criterion icons in Done column).

- [ ] **Step 3: Run check**

Run: `bun run check`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/routes/class/[classId]/+page.svelte
git commit -m "feat(ui): criteria icons in Done column; screenshot toggle in Actions"
```

---

### Task 8: Lesson detail + semester legend + README

**Files:**
- Modify: `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`
- Modify: `src/routes/class/[classId]/SemesterMap.svelte`
- Modify: `README.md`

- [ ] **Step 1: Lesson detail criteria checklist**

Replace `doneColumnTooltip` / `screenshotMissing` block with criteria icons (same pattern as table, read-only) and summary:

- Past + `done` → “Done (all requirements on disk)”
- Past + not done → list missing criteria from `criteria`
- Future → “Scheduled (not yet counted as done)”

Ensure `+page.ts` load returns enriched lesson with `criteria` (from existing class lessons load).

- [ ] **Step 2: SemesterMap legend**

Change “Done (note on disk)” → “Done (all session requirements on disk)” or similar per spec.

- [ ] **Step 3: README**

Document:

- `presenze.csv` at class root (row 0 stems, col 0 names)
- Done = note + screenshot + presenze (class only)
- Done column icons / green check

- [ ] **Step 4: Commit**

```bash
git add src/routes/class/[classId]/lesson/[lessonId]/+page.svelte src/routes/class/[classId]/SemesterMap.svelte README.md
git commit -m "docs(ui): lesson detail criteria and README for presenze.csv"
```

---

### Task 9: Full verification

- [ ] **Step 1: Run unit tests**

Run: `bun run test`  
Expected: all PASS

- [ ] **Step 2: Run check**

Run: `bun run check`  
Expected: PASS

- [ ] **Step 3: Manual verification**

Follow spec manual checklist (7 items in design spec).

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| SESSION_CRITERIA registry | 5 |
| note / screenshot / attendance rules | 5, 6 |
| d3-dsv + Zod CSV | 2, 3, 4 |
| presenze.csv at class root | 3, 6 |
| Derived `done` | 6 |
| Done column icons / green ✓ | 7 |
| Future/skipped `—` | 6, 7 |
| Hours ⚠ | 7 |
| Actions screenshot preview | 7 |
| Remove screenshotMissing / row click | 6, 7 |
| Lesson detail checklist | 8 |
| Semester dots use `done` | 6 (no UI change) |
| presenze_parse_error warning | 6 |
| README | 8 |

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-02-session-completion-criteria.md`.

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  

**2. Inline Execution** — run tasks in this session with executing-plans checkpoints  

Which approach do you want?
