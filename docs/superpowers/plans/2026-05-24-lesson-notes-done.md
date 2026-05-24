# Lesson notes drive “done” — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Derive session **done** from `lezioni/` and `extra/` markdown notes (date match), show warnings for hour/orphan/duplicate/parse issues, and update class UI (warnings strip, read-only done, upcoming row highlight, calendar done dots).

**Architecture:** Pure `src/lib/lessonNotes/*` modules (parse, match, upcoming, calendar helpers) tested without FSA. Class `+page.ts` scans linked folder via existing `getFolderHandle` + new `listMarkdownNotesInSubdir`. Enriched lessons flow to `SemesterMap` and stats. `done` is not user-editable for `class`/`extra`; flush re-scans before writing `planner.json` so git diffs stay accurate.

**Tech Stack:** SvelteKit 2, Svelte 5, Dexie 4, File System Access API, Vitest, Bun

**Spec:** `docs/superpowers/specs/2026-05-24-lesson-notes-done-design.md`

**Depends on:** Per-class file storage (`classFolders` meta, `classFolder.ts`) — already in repo.

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/lessonNotes/types.ts` | **Create** | `LessonNoteWarning`, `ScannedNote`, `ParsedNote`, `EnrichedLesson` |
| `src/lib/lessonNotes/parseFrontmatter.ts` | **Create** | Parse `data` / `durata` from `.md` text |
| `src/lib/lessonNotes/parseFrontmatter.test.ts` | **Create** | Parse tests |
| `src/lib/lessonNotes/match.ts` | **Create** | `matchNotesToLessons` + warnings |
| `src/lib/lessonNotes/match.test.ts` | **Create** | Match/orphan/duplicate/hours tests |
| `src/lib/lessonNotes/upcoming.ts` | **Create** | `upcomingSessionDate` |
| `src/lib/lessonNotes/upcoming.test.ts` | **Create** | Upcoming date tests |
| `src/lib/lessonNotes/calendarDone.ts` | **Create** | `kindDotsDoneByDate` for `SemesterMap` |
| `src/lib/lessonNotes/calendarDone.test.ts` | **Create** | Dot-done map tests |
| `src/lib/lessonNotes/scanFolder.ts` | **Create** | FSA: list + parse `lezioni/` / `extra/` |
| `src/lib/lessonNotes/enrich.ts` | **Create** | `enrichClassLessonsFromFolder(classId, lessons)` |
| `src/lib/persistence/classFolder.ts` | **Modify** | `listMarkdownFilesInSubdir(handle, name)` |
| `src/lib/persistence/flush.ts` | **Modify** | Apply derived `done` on snapshot before write |
| `src/lib/logic/sessionKind.ts` | **Modify** | `doneEditable: false` for class/extra |
| `src/routes/class/[classId]/+page.ts` | **Modify** | Scan + return enriched lessons, warnings, upcoming |
| `src/routes/class/[classId]/+page.svelte` | **Modify** | Warnings strip, refresh, table UI, remove `toggleDone` |
| `src/routes/class/[classId]/SemesterMap.svelte` | **Modify** | `dot-done` styling + legend |
| `src/routes/class/[classId]/lesson/[lessonId]/+page.ts` | **Modify** | Enrich single lesson for derived done |
| `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte` | **Modify** | Read-only done display |
| `README.md` | **Modify** | Document `lezioni/` / `extra/` done rule |

---

### Task 1: Types + frontmatter parser

**Files:**
- Create: `src/lib/lessonNotes/types.ts`
- Create: `src/lib/lessonNotes/parseFrontmatter.ts`
- Create: `src/lib/lessonNotes/parseFrontmatter.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/lessonNotes/parseFrontmatter.test.ts
import { describe, expect, it } from 'vitest';
import { parseLessonNoteMarkdown } from './parseFrontmatter';

const SAMPLE = `---
data: 09/03/2026
durata: 4.5
---

- bullet
`;

describe('parseLessonNoteMarkdown', () => {
	it('parses Italian date and durata', () => {
		const r = parseLessonNoteMarkdown(SAMPLE, '01.md');
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.dateIso).toBe('2026-03-09');
			expect(r.durationHours).toBe(4.5);
		}
	});

	it('rejects missing data', () => {
		const r = parseLessonNoteMarkdown('---\ndurata: 1\n---\n', 'x.md');
		expect(r.ok).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/lessonNotes/parseFrontmatter.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement types + parser**

```ts
// src/lib/lessonNotes/types.ts
import type { LessonRow, LessonSessionKind } from '$lib/db/types';

export type NoteFolder = 'lezioni' | 'extra';

export type LessonNoteWarningCode =
	| 'hours_mismatch'
	| 'duplicate_date'
	| 'orphan_note'
	| 'parse_error';

export type LessonNoteWarning = {
	code: LessonNoteWarningCode;
	message: string;
	lessonId?: string;
	dateIso?: string;
};

export type ScannedNote = {
	folder: NoteFolder;
	fileName: string;
	dateIso: string;
	durationHours: number;
};

export type LessonHoursWarning = {
	plannerHours: number;
	noteHours: number;
	fileName: string;
	folder: NoteFolder;
};

export type EnrichedLesson = LessonRow & {
	hoursWarning?: LessonHoursWarning;
};

export function folderForSessionKind(kind: LessonSessionKind): NoteFolder | null {
	if (kind === 'class') return 'lezioni';
	if (kind === 'extra') return 'extra';
	return null;
}
```

```ts
// src/lib/lessonNotes/parseFrontmatter.ts
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

export type ParseNoteOk = { ok: true; dateIso: string; durationHours: number };
export type ParseNoteErr = { ok: false; error: string };
export type ParseNoteResult = ParseNoteOk | ParseNoteErr;

/** `DD/MM/YYYY` → `YYYY-MM-DD` (UTC calendar day, same as semester map). */
export function italianDateToIso(value: string): string | null {
	const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
	if (!m) return null;
	const dd = Number(m[1]);
	const mm = Number(m[2]);
	const yy = Number(m[3]);
	if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
	return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function parseLessonNoteMarkdown(text: string, _fileName: string): ParseNoteResult {
	const fm = text.match(FRONTMATTER_RE);
	if (!fm) return { ok: false, error: 'missing frontmatter' };
	const block = fm[1];
	const dataLine = block.match(/^data:\s*(.+)$/m);
	const durataLine = block.match(/^durata:\s*([\d.]+)\s*$/m);
	if (!dataLine) return { ok: false, error: 'missing data:' };
	if (!durataLine) return { ok: false, error: 'missing durata:' };
	const dateIso = italianDateToIso(dataLine[1]);
	if (!dateIso) return { ok: false, error: 'invalid data:' };
	const durationHours = Number(durataLine[1]);
	if (!Number.isFinite(durationHours) || durationHours < 0) {
		return { ok: false, error: 'invalid durata:' };
	}
	return { ok: true, dateIso, durationHours };
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test src/lib/lessonNotes/parseFrontmatter.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/lessonNotes/
git commit -m "feat(lesson-notes): parse lezioni/extra markdown frontmatter"
```

---

### Task 2: Match notes to lessons (pure)

**Files:**
- Create: `src/lib/lessonNotes/match.ts`
- Create: `src/lib/lessonNotes/match.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/lessonNotes/match.test.ts
import { describe, expect, it } from 'vitest';
import { matchNotesToLessons } from './match';
import type { LessonRow } from '$lib/db/types';

function lesson(overrides: Partial<LessonRow> & Pick<LessonRow, 'id' | 'date' | 'sessionKind'>): LessonRow {
	return {
		classId: 'c1',
		durationHours: 5,
		title: 'Lesson',
		done: false,
		...overrides
	};
}

describe('matchNotesToLessons', () => {
	it('marks class session done when lezioni note exists for date', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'class' })];
		const { lessons: out, warnings } = matchNotesToLessons(lessons, [
			{ folder: 'lezioni', fileName: '01.md', dateIso: '2026-03-09', durationHours: 5 }
		], []);
		expect(out[0].done).toBe(true);
		expect(warnings).toHaveLength(0);
	});

	it('hours mismatch is warning only, still done', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'class', durationHours: 5 })];
		const { lessons: out, warnings } = matchNotesToLessons(lessons, [
			{ folder: 'lezioni', fileName: '01.md', dateIso: '2026-03-09', durationHours: 4.5 }
		], []);
		expect(out[0].done).toBe(true);
		expect(out[0].hoursWarning?.noteHours).toBe(4.5);
		expect(warnings.some((w) => w.code === 'hours_mismatch')).toBe(true);
	});

	it('orphan lezioni note warns and does not affect unrelated lessons', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-16', sessionKind: 'class' })];
		const { warnings } = matchNotesToLessons(lessons, [
			{ folder: 'lezioni', fileName: '99.md', dateIso: '2026-03-09', durationHours: 1 }
		], []);
		expect(warnings.some((w) => w.code === 'orphan_note')).toBe(true);
	});

	it('skipped sessions stay not done', () => {
		const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'skipped' })];
		const { lessons: out } = matchNotesToLessons(lessons, [
			{ folder: 'lezioni', fileName: '01.md', dateIso: '2026-03-09', durationHours: 1 }
		], []);
		expect(out[0].done).toBe(false);
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement `match.ts`**

```ts
// src/lib/lessonNotes/match.ts
import type { LessonRow } from '$lib/db/types';
import type {
	EnrichedLesson,
	LessonNoteWarning,
	NoteFolder,
	ScannedNote
} from './types';
import { folderForSessionKind } from './types';

export type MatchResult = {
	lessons: EnrichedLesson[];
	warnings: LessonNoteWarning[];
};

function groupByDate(notes: ScannedNote[]): Map<string, ScannedNote[]> {
	const map = new Map<string, ScannedNote[]>();
	for (const n of notes) {
		const list = map.get(n.dateIso) ?? [];
		list.push(n);
		map.set(n.dateIso, list);
	}
	return map;
}

function duplicateWarnings(folder: NoteFolder, byDate: Map<string, ScannedNote[]>): LessonNoteWarning[] {
	const out: LessonNoteWarning[] = [];
	for (const [dateIso, list] of byDate) {
		if (list.length > 1) {
			const names = list.map((n) => n.fileName).join(', ');
			out.push({
				code: 'duplicate_date',
				message: `Duplicate notes for ${dateIso} in ${folder}/ (${names})`,
				dateIso
			});
		}
	}
	return out;
}

function orphanWarnings(
	lessons: LessonRow[],
	folder: NoteFolder,
	kind: 'class' | 'extra',
	byDate: Map<string, ScannedNote[]>
): LessonNoteWarning[] {
	const sessionDates = new Set(
		lessons.filter((l) => l.sessionKind === kind).map((l) => l.date)
	);
	const out: LessonNoteWarning[] = [];
	for (const [dateIso, list] of byDate) {
		if (!sessionDates.has(dateIso)) {
			for (const n of list) {
				out.push({
					code: 'orphan_note',
					message: `Orphan note: ${folder}/${n.fileName} dated ${dateIso} (no matching session)`,
					dateIso
				});
			}
		}
	}
	return out;
}

export function matchNotesToLessons(
	lessons: LessonRow[],
	lezioniNotes: ScannedNote[],
	extraNotes: ScannedNote[]
): MatchResult {
	const lezioniByDate = groupByDate(lezioniNotes);
	const extraByDate = groupByDate(extraNotes);

	const warnings: LessonNoteWarning[] = [
		...duplicateWarnings('lezioni', lezioniByDate),
		...duplicateWarnings('extra', extraByDate),
		...orphanWarnings(lessons, 'lezioni', 'class', lezioniByDate),
		...orphanWarnings(lessons, 'extra', 'extra', extraByDate)
	];

	const enriched: EnrichedLesson[] = lessons.map((lesson) => {
		if (lesson.sessionKind === 'skipped') {
			return { ...lesson, done: false };
		}
		const folder = folderForSessionKind(lesson.sessionKind);
		if (!folder) return { ...lesson, done: false };

		const byDate = folder === 'lezioni' ? lezioniByDate : extraByDate;
		const notes = byDate.get(lesson.date) ?? [];
		if (notes.length === 0) {
			return { ...lesson, done: false };
		}

		const note = notes[0];
		const row: EnrichedLesson = { ...lesson, done: true };
		if (note.durationHours !== lesson.durationHours) {
			row.hoursWarning = {
				plannerHours: lesson.durationHours,
				noteHours: note.durationHours,
				fileName: note.fileName,
				folder
			};
			warnings.push({
				code: 'hours_mismatch',
				message: `Hours: planner ${lesson.durationHours}h vs ${folder}/${note.fileName} ${note.durationHours}h (${lesson.date})`,
				lessonId: lesson.id,
				dateIso: lesson.date
			});
		}
		return row;
	});

	return { lessons: enriched, warnings };
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/lessonNotes/match.ts src/lib/lessonNotes/match.test.ts
git commit -m "feat(lesson-notes): match markdown notes to lessons with warnings"
```

---

### Task 3: Upcoming session + calendar done helpers

**Files:**
- Create: `src/lib/lessonNotes/upcoming.ts`
- Create: `src/lib/lessonNotes/upcoming.test.ts`
- Create: `src/lib/lessonNotes/calendarDone.ts`
- Create: `src/lib/lessonNotes/calendarDone.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// upcoming.test.ts
import { describe, expect, it } from 'vitest';
import { upcomingSessionDate } from './upcoming';

describe('upcomingSessionDate', () => {
	it('returns earliest class/extra date on or after today', () => {
		expect(
			upcomingSessionDate(
				[
					{ date: '2026-03-01', sessionKind: 'class' },
					{ date: '2026-03-10', sessionKind: 'class' },
					{ date: '2026-03-10', sessionKind: 'extra' }
				],
				'2026-03-09'
			)
		).toBe('2026-03-10');
	});

	it('returns null when no future class/extra', () => {
		expect(
			upcomingSessionDate([{ date: '2026-01-01', sessionKind: 'class' }], '2026-03-09')
		).toBeNull();
	});
});
```

```ts
// calendarDone.test.ts
import { describe, expect, it } from 'vitest';
import { kindDotsDoneByDate } from './calendarDone';

describe('kindDotsDoneByDate', () => {
	it('class dot done only if all class sessions that day are done', () => {
		const map = kindDotsDoneByDate([
			{ date: '2026-03-09', sessionKind: 'class', done: true },
			{ date: '2026-03-09', sessionKind: 'class', done: false }
		]);
		expect(map.get('2026-03-09')?.class).toBe(false);
	});
});
```

- [ ] **Step 2: Implement**

```ts
// upcoming.ts
import type { LessonRow } from '$lib/db/types';
import { compareIsoDate } from '$lib/logic/semesterCalendar';

export function upcomingSessionDate(
	lessons: Pick<LessonRow, 'date' | 'sessionKind'>[],
	todayIso: string
): string | null {
	const candidates = lessons
		.filter((l) => l.sessionKind === 'class' || l.sessionKind === 'extra')
		.filter((l) => compareIsoDate(l.date, todayIso) >= 0)
		.map((l) => l.date)
		.sort(compareIsoDate);
	return candidates[0] ?? null;
}
```

```ts
// calendarDone.ts
import type { LessonSessionKind } from '$lib/db/types';

type LessonDoneSlice = { date: string; sessionKind: LessonSessionKind; done: boolean };

export type KindDoneFlags = { class: boolean; extra: boolean; skipped: boolean };

export function kindDotsDoneByDate(lessons: LessonDoneSlice[]): Map<string, KindDoneFlags> {
	const map = new Map<string, KindDoneFlags>();
	const ensure = (date: string): KindDoneFlags => {
		let v = map.get(date);
		if (!v) {
			v = { class: true, extra: true, skipped: false };
			map.set(date, v);
		}
		return v;
	};

	for (const l of lessons) {
		if (l.sessionKind === 'skipped') continue;
		const flags = ensure(l.date);
		if (l.sessionKind === 'class' && !l.done) flags.class = false;
		if (l.sessionKind === 'extra' && !l.done) flags.extra = false;
	}

	for (const [date, flags] of map) {
		const hasClass = lessons.some((l) => l.date === date && l.sessionKind === 'class');
		const hasExtra = lessons.some((l) => l.date === date && l.sessionKind === 'extra');
		if (!hasClass) flags.class = false;
		if (!hasExtra) flags.extra = false;
		if (!map.get(date)) map.set(date, flags);
	}

	return map;
}
```

Refine `kindDotsDoneByDate`: only set `class: true` when at least one class lesson exists and all are done; default false when no class that day. (Implement carefully in step 3 — tests drive behavior.)

- [ ] **Step 3: Run tests — PASS**

- [ ] **Step 4: Commit**

```bash
git add src/lib/lessonNotes/upcoming.* src/lib/lessonNotes/calendarDone.*
git commit -m "feat(lesson-notes): upcoming date and calendar done helpers"
```

---

### Task 4: FSA scan + enrich entrypoint

**Files:**
- Modify: `src/lib/persistence/classFolder.ts`
- Create: `src/lib/lessonNotes/scanFolder.ts`
- Create: `src/lib/lessonNotes/enrich.ts`

- [ ] **Step 1: Add subdir listing to `classFolder.ts`**

```ts
export async function listMarkdownFilesInSubdir(
	root: FileSystemDirectoryHandle,
	subdirName: string
): Promise<{ fileName: string; text: string }[]> {
	let subdir: FileSystemDirectoryHandle;
	try {
		subdir = await root.getDirectoryHandle(subdirName);
	} catch {
		return [];
	}
	const out: { fileName: string; text: string }[] = [];
	for await (const [name, handle] of subdir.entries()) {
		if (handle.kind !== 'file' || !name.endsWith('.md')) continue;
		const file = await handle.getFile();
		out.push({ fileName: name, text: await file.text() });
	}
	return out;
}
```

- [ ] **Step 2: Implement scan + enrich**

```ts
// scanFolder.ts
import { listMarkdownFilesInSubdir } from '$lib/persistence/classFolder';
import { parseLessonNoteMarkdown } from './parseFrontmatter';
import type { LessonNoteWarning, NoteFolder, ScannedNote } from './types';

export async function scanNotesSubdir(
	root: FileSystemDirectoryHandle,
	folder: NoteFolder
): Promise<{ notes: ScannedNote[]; warnings: LessonNoteWarning[] }> {
	const files = await listMarkdownFilesInSubdir(root, folder);
	const notes: ScannedNote[] = [];
	const warnings: LessonNoteWarning[] = [];
	for (const { fileName, text } of files) {
		const parsed = parseLessonNoteMarkdown(text, fileName);
		if (!parsed.ok) {
			warnings.push({
				code: 'parse_error',
				message: `Could not parse ${folder}/${fileName} (${parsed.error})`
			});
			continue;
		}
		notes.push({
			folder,
			fileName,
			dateIso: parsed.dateIso,
			durationHours: parsed.durationHours
		});
	}
	return { notes, warnings };
}
```

```ts
// enrich.ts
import type { ClassId } from '$lib/db/types';
import type { LessonRow } from '$lib/db/types';
import { ensureReadWritePermission } from '$lib/persistence/classFolder';
import { getFolderHandle } from '$lib/persistence/meta';
import { matchNotesToLessons } from './match';
import { scanNotesSubdir } from './scanFolder';
import type { EnrichedLesson, LessonNoteWarning } from './types';
import { upcomingSessionDate } from './upcoming';
import { toUtcIsoCalendarDate } from '$lib/logic/semesterCalendar';

export type ClassLessonsEnrichment = {
	lessons: EnrichedLesson[];
	warnings: LessonNoteWarning[];
	upcomingDate: string | null;
	notesScanned: boolean;
};

export async function enrichClassLessonsFromFolder(
	classId: ClassId,
	lessons: LessonRow[]
): Promise<ClassLessonsEnrichment> {
	const handle = await getFolderHandle(classId);
	if (!handle) {
		return {
			lessons: lessons.map((l) => ({ ...l })),
			warnings: [],
			upcomingDate: upcomingSessionDate(lessons, toUtcIsoCalendarDate(new Date())),
			notesScanned: false
		};
	}
	await ensureReadWritePermission(handle);
	const [lezioni, extra] = await Promise.all([
		scanNotesSubdir(handle, 'lezioni'),
		scanNotesSubdir(handle, 'extra')
	]);
	const matched = matchNotesToLessons(lessons, lezioni.notes, extra.notes);
	return {
		lessons: matched.lessons,
		warnings: [...lezioni.warnings, ...extra.warnings, ...matched.warnings],
		upcomingDate: upcomingSessionDate(matched.lessons, toUtcIsoCalendarDate(new Date())),
		notesScanned: true
	};
}
```

- [ ] **Step 3: Run full test suite**

Run: `bun run check && bun run test`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/persistence/classFolder.ts src/lib/lessonNotes/scanFolder.ts src/lib/lessonNotes/enrich.ts
git commit -m "feat(lesson-notes): scan lezioni/extra from class folder handle"
```

---

### Task 5: Class page load + flush derived done

**Files:**
- Modify: `src/routes/class/[classId]/+page.ts`
- Modify: `src/lib/persistence/flush.ts`

- [ ] **Step 1: Update class page load**

```ts
// src/routes/class/[classId]/+page.ts
import type { PageLoad } from './$types';
import { classLessonsLoadKey } from '$lib/kit/loadKeys';
import { listLessons } from '$lib/repos/lessons.repo';
import { enrichClassLessonsFromFolder } from '$lib/lessonNotes/enrich';

export const load: PageLoad = async ({ params, parent, depends }) => {
	depends(classLessonsLoadKey(params.classId));
	await parent();
	const raw = await listLessons(params.classId);
	const enriched = await enrichClassLessonsFromFolder(params.classId, raw);
	return {
		lessons: enriched.lessons,
		noteWarnings: enriched.warnings,
		upcomingDate: enriched.upcomingDate,
		notesScanned: enriched.notesScanned
	};
};
```

- [ ] **Step 2: Write derived done on flush**

```ts
// In flushClassNow, after loadClassSnapshot:
import { enrichClassLessonsFromFolder } from '$lib/lessonNotes/enrich';

const snapshot = await loadClassSnapshot(classId);
const { lessons, notesScanned } = await enrichClassLessonsFromFolder(classId, snapshot.lessons);
if (notesScanned) {
	snapshot.lessons = lessons.map((l) => ({
		...l,
		done: l.done
	}));
}
await writePlannerFile(handle, snapshot);
```

- [ ] **Step 3: Run `bun run check && bun run test`**

- [ ] **Step 4: Commit**

```bash
git add src/routes/class/[classId]/+page.ts src/lib/persistence/flush.ts
git commit -m "feat(lesson-notes): enrich class load and flush derived done to planner.json"
```

---

### Task 6: Disable manual done + class page UI

**Files:**
- Modify: `src/lib/logic/sessionKind.ts`
- Modify: `src/routes/class/[classId]/+page.svelte`
- Modify: `src/lib/logic/sessionKind.test.ts` (if exists — update expectations)

- [ ] **Step 1: `doneEditable: false` for class and extra**

```ts
// sessionKind.ts — inside lessonFormUi
doneEditable: false,
doneDisabledTitle:
	skipped
		? 'Skipped sessions cannot be marked done.'
		: 'Done is set automatically from lesson notes on disk (lezioni/ or extra/).',
```

Remove `!skipped` from `doneEditable` line (always false for all kinds, or keep skipped false with same message).

- [ ] **Step 2: Class page UI**

In `+page.svelte`:

1. Delete `toggleDone` and checkbox `onchange`.
2. Add warnings block after `<h1>`:

```svelte
{#if data.notesScanned && data.noteWarnings.length > 0}
	<section class="warnings" aria-label="Lesson note warnings">
		<div class="warnings__head">
			<h2 class="warnings__title">Notes</h2>
			<button type="button" class="btn" onclick={refreshNotes}>Refresh from folder</button>
		</div>
		<ul>
			{#each data.noteWarnings as w (w.message)}
				<li>{w.message}</li>
			{/each}
		</ul>
	</section>
{:else if data.notesScanned}
	<p class="warnings__head">
		<button type="button" class="btn" onclick={refreshNotes}>Refresh from folder</button>
	</p>
{/if}
```

```ts
async function refreshNotes() {
	await invalidateLoadKeys(classLessonsKey);
}
```

3. Done column — read-only:

```svelte
<td>
	{#if lesson.sessionKind === 'skipped'}
		<span class="muted">—</span>
	{:else if lesson.done}
		<span title="Note on disk">✓</span>
		{#if lesson.hoursWarning}
			<span class="warn-icon" title="Hours differ from note">⚠</span>
		{/if}
	{:else}
		<span class="muted">—</span>
	{/if}
</td>
```

4. Upcoming row:

```svelte
<tr class:upcoming={data.upcomingDate !== null && lesson.date === data.upcomingDate}>
```

```css
tr.upcoming {
	background: #f0f7ff;
	box-shadow: inset 3px 0 0 #1967d2;
}
```

5. Pass enriched lessons to `SemesterMap` and `buildTeacherHourStatBoxes` (already uses `data.lessons`).

- [ ] **Step 3: Run check/test**

- [ ] **Step 4: Commit**

```bash
git add src/lib/logic/sessionKind.ts src/routes/class/[classId]/+page.svelte
git commit -m "feat(ui): warnings strip, derived done column, upcoming session highlight"
```

---

### Task 7: Semester map done dots

**Files:**
- Modify: `src/routes/class/[classId]/SemesterMap.svelte`

- [ ] **Step 1: Import helper and compute map**

```svelte
import { kindDotsDoneByDate } from '$lib/lessonNotes/calendarDone';

const doneByDate = $derived(kindDotsDoneByDate(lessons));
```

- [ ] **Step 2: Add `dot-done` class on dots**

```svelte
{#each [...(kindsMap.get(cell.isoDate) ?? [])].sort() as k (k)}
	{@const doneFlags = doneByDate.get(cell.isoDate)}
	<i
		class="dot {k}"
		class:dot-done={k === 'class' && doneFlags?.class}
		class:dot-done={k === 'extra' && doneFlags?.extra}
	></i>
{/each}
```

(Svelte 5: use single `class:dot-done` with expression `k === 'class' && doneFlags?.class || k === 'extra' && doneFlags?.extra`.)

- [ ] **Step 3: Legend + CSS**

```svelte
<span><i class="dot class dot-done"></i> Done (note on disk)</span>
```

```css
i.dot.dot-done {
	box-shadow: inset 0 0 0 2px var(--dot-class-border);
	background: var(--dot-class-border);
}
i.dot.extra.dot-done {
	box-shadow: inset 0 0 0 2px var(--dot-extra-border);
	background: var(--dot-extra-border);
}
```

- [ ] **Step 4: Optional cell `title` if warnings for that date** (grep warnings by `dateIso` in parent — pass `noteWarnings` prop if needed).

- [ ] **Step 5: Commit**

```bash
git add src/routes/class/[classId]/SemesterMap.svelte src/routes/class/[classId]/+page.svelte
git commit -m "feat(ui): show done state on semester calendar dots"
```

---

### Task 8: Lesson detail + README

**Files:**
- Modify: `src/routes/class/[classId]/lesson/[lessonId]/+page.ts`
- Modify: `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`
- Modify: `README.md`

- [ ] **Step 1: Enrich lesson in load**

```ts
import { enrichClassLessonsFromFolder } from '$lib/lessonNotes/enrich';

const raw = await getLesson(...);
const { lessons } = await enrichClassLessonsFromFolder(params.classId, [raw]);
const lesson = lessons[0];
```

- [ ] **Step 2: Replace done checkbox with read-only block**

```svelte
<p class="done-readonly">
	Done:
	{#if lesson.done}
		Yes (note in {lesson.sessionKind === 'extra' ? 'extra/' : 'lezioni/'})
	{:else}
		No matching note for this date
	{/if}
	{#if lesson.hoursWarning}
		<span class="warn"> — planner {lesson.hoursWarning.plannerHours}h, note {lesson.hoursWarning.noteHours}h</span>
	{/if}
</p>
```

Remove `done` from `persistLessonMeta` / `changeSessionKind` payloads (or rely on `doneEditable: false` forcing false — strip `done` from update calls entirely).

- [ ] **Step 3: README section**

Document:

- `lezioni/*.md` and `extra/*.md` frontmatter
- Done is automatic from date match
- Hour mismatches show as warnings
- Chrome/Edge folder link required

- [ ] **Step 4: `bun run check && bun run test`**

- [ ] **Step 5: Commit**

```bash
git add src/routes/class/[classId]/lesson README.md
git commit -m "docs: lesson notes done rule; read-only done on lesson page"
```

---

## Manual verification

1. Link class folder containing `lezioni/01.md` with `data` matching a session → ✓ done, solid calendar dot.
2. Edit `durata` to differ from planner → still ✓, warning in list.
3. **Refresh from folder** after adding `02.md` → updates without full reload.
4. Next future session date → highlighted rows.
5. `planner.json` on disk after edit shows `done` matching files (post-flush).
6. Skipped session → no done, no note scan expectation.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Derived done by date | 2, 4, 5 |
| Hours mismatch warning only | 2 |
| `lezioni` / `extra` folders | 4 |
| Warnings list | 2, 6 |
| Scan on class load + refresh | 4, 5, 6 |
| Calendar done dots | 3, 7 |
| Upcoming session highlight | 3, 6 |
| Read-only done / no toggle | 6, 8 |
| Flush writes derived done | 5 |
| Skipped unchanged | 2 |
| Orphan/duplicate/parse warnings | 2, 4 |
| No md editing in app | — (non-goal) |

No TBD steps. Types consistent across tasks.
