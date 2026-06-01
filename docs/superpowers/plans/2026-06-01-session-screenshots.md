# Session screenshots & revised “done” — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require note + paired `*-screen.png` for derived **done**, show ⚠ in the sessions table for past sessions missing screenshots, and let users click rows to expand inline PNG previews.

**Architecture:** Extend the existing `lessonNotes` enrich pipeline: scan PNG basenames in `lezioni/` and `extra/`, pass a `ScreenshotIndex` into pure `matchNotesToLessons` with `todayIso`. UI loads image bytes lazily via File System Access API on row expand. `flush.ts` already re-enriches before write — no extra change once match is updated.

**Tech Stack:** SvelteKit 2, Svelte 5, Dexie 4, File System Access API, Vitest, Bun

**Spec:** `docs/superpowers/specs/2026-06-01-session-screenshots-design.md`

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/lessonNotes/screenshot.ts` | **Create** | `screenshotFileNameForNote`, `doneTooltip`, PNG listing helper types |
| `src/lib/lessonNotes/screenshot.test.ts` | **Create** | Pure helper tests |
| `src/lib/lessonNotes/types.ts` | **Modify** | `ScreenshotRef`, extend `EnrichedLesson` |
| `src/lib/lessonNotes/match.ts` | **Modify** | Revised `done`, `screenshotMissing`, `screenshotRef`, `matchedNote` |
| `src/lib/lessonNotes/match.test.ts` | **Modify** | Update existing tests + screenshot cases |
| `src/lib/persistence/classFolder.ts` | **Modify** | `listPngFileNamesInSubdir` |
| `src/lib/persistence/classFolder.test.ts` | **Modify** | PNG list tests (mock handle if needed, or test via integration-style mock) |
| `src/lib/lessonNotes/scanFolder.ts` | **Modify** | `scanScreenshotsSubdir` returning `Set<string>` |
| `src/lib/lessonNotes/enrich.ts` | **Modify** | Scan PNGs, pass index + `todayIso` to match |
| `src/lib/lessonNotes/loadScreenshot.ts` | **Create** | `loadScreenshotObjectUrl(classId, ref)` + revoke helper |
| `src/routes/class/[classId]/+page.svelte` | **Modify** | Done ⚠, expandable rows, lazy images |
| `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte` | **Modify** | Done copy matches new rules |
| `README.md` | **Modify** | Document `*-screen.png` pairing and done rule |

---

### Task 1: Screenshot filename helpers

**Files:**
- Create: `src/lib/lessonNotes/screenshot.ts`
- Create: `src/lib/lessonNotes/screenshot.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/lessonNotes/screenshot.test.ts
import { describe, expect, it } from 'vitest';
import { screenshotFileNameForNote, screenshotPathLabel } from './screenshot';

describe('screenshotFileNameForNote', () => {
	it('maps 09.md to 09-screen.png', () => {
		expect(screenshotFileNameForNote('09.md')).toBe('09-screen.png');
	});

	it('rejects non-md names', () => {
		expect(screenshotFileNameForNote('09-screen.png')).toBeNull();
	});
});

describe('screenshotPathLabel', () => {
	it('joins folder and file', () => {
		expect(screenshotPathLabel('lezioni', '09-screen.png')).toBe('lezioni/09-screen.png');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/lessonNotes/screenshot.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement helpers**

```ts
// src/lib/lessonNotes/screenshot.ts
import type { NoteFolder } from './types';

export function screenshotFileNameForNote(noteFileName: string): string | null {
	if (!noteFileName.endsWith('.md')) return null;
	return `${noteFileName.slice(0, -3)}-screen.png`;
}

export function screenshotPathLabel(folder: NoteFolder, pngFileName: string): string {
	return `${folder}/${pngFileName}`;
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test src/lib/lessonNotes/screenshot.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/lessonNotes/screenshot.ts src/lib/lessonNotes/screenshot.test.ts
git commit -m "feat(lessonNotes): add screenshot filename helpers"
```

---

### Task 2: List PNG files in class subdirs

**Files:**
- Modify: `src/lib/persistence/classFolder.ts`
- Modify: `src/lib/persistence/classFolder.test.ts`
- Modify: `src/lib/lessonNotes/scanFolder.ts`

- [ ] **Step 1: Add `listPngFileNamesInSubdir` to classFolder.ts**

```ts
export async function listPngFileNamesInSubdir(
	root: FileSystemDirectoryHandle,
	subdirName: string
): Promise<Set<string>> {
	let subdir: FileSystemDirectoryHandle;
	try {
		subdir = await root.getDirectoryHandle(subdirName);
	} catch {
		return new Set();
	}
	const names = new Set<string>();
	for await (const [name, handle] of subdir.entries()) {
		if (handle.kind !== 'file') continue;
		if (!name.toLowerCase().endsWith('.png')) continue;
		names.add(name);
	}
	return names;
}
```

- [ ] **Step 2: Add `scanScreenshotsSubdir` in scanFolder.ts**

```ts
import { listPngFileNamesInSubdir } from '$lib/persistence/classFolder';
import type { NoteFolder } from './types';

export async function scanScreenshotsSubdir(
	root: FileSystemDirectoryHandle,
	folder: NoteFolder
): Promise<Set<string>> {
	return listPngFileNamesInSubdir(root, folder);
}
```

- [ ] **Step 3: Add unit test** (use a minimal mock `FileSystemDirectoryHandle` with `entries()` yielding one `.png`, or test `listPngFileNamesInSubdir` in `classFolder.test.ts` following existing patterns in that file).

- [ ] **Step 4: Run tests**

Run: `bun run test src/lib/persistence/classFolder.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/persistence/classFolder.ts src/lib/persistence/classFolder.test.ts src/lib/lessonNotes/scanFolder.ts
git commit -m "feat: list PNG filenames in lezioni/ and extra/"
```

---

### Task 3: Extend types + match logic (TDD)

**Files:**
- Modify: `src/lib/lessonNotes/types.ts`
- Modify: `src/lib/lessonNotes/match.ts`
- Modify: `src/lib/lessonNotes/match.test.ts`

- [ ] **Step 1: Extend types**

```ts
export type ScreenshotRef = {
	folder: NoteFolder;
	fileName: string;
};

export type MatchedNoteRef = {
	folder: NoteFolder;
	fileName: string;
};

export type EnrichedLesson = LessonRow & {
	hoursWarning?: LessonHoursWarning;
	screenshotMissing?: boolean;
	screenshotRef?: ScreenshotRef;
	matchedNote?: MatchedNoteRef;
};
```

- [ ] **Step 2: Add `MatchContext` and update failing tests**

Add to `match.test.ts` (use fixed `todayIso: '2026-06-01'`):

```ts
const PNGS = {
	lezioni: new Set<string>(),
	extra: new Set<string>()
};

function match(lessons: LessonRow[], lezioni: ScannedNote[], extra: ScannedNote[], pngs = PNGS) {
	return matchNotesToLessons(lessons, lezioni, extra, {
		todayIso: '2026-06-01',
		screenshots: pngs
	});
}
```

New tests:

```ts
it('done only when note and paired png exist (past)', () => {
	const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'class' })];
	const { lessons: out } = match(
		lessons,
		[{ folder: 'lezioni', fileName: '09.md', dateIso: '2026-03-09', durationHours: 5 }],
		[],
		{ lezioni: new Set(['09-screen.png']), extra: new Set() }
	);
	expect(out[0].done).toBe(true);
	expect(out[0].screenshotRef).toEqual({ folder: 'lezioni', fileName: '09-screen.png' });
});

it('note without png: not done, screenshotMissing', () => {
	const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'class' })];
	const { lessons: out } = match(
		lessons,
		[{ folder: 'lezioni', fileName: '09.md', dateIso: '2026-03-09', durationHours: 5 }],
		[],
		{ lezioni: new Set(), extra: new Set() }
	);
	expect(out[0].done).toBe(false);
	expect(out[0].screenshotMissing).toBe(true);
});

it('past session without note: screenshotMissing', () => {
	const lessons = [lesson({ id: '1', date: '2026-03-09', sessionKind: 'class' })];
	const { lessons: out } = match(lessons, [], []);
	expect(out[0].screenshotMissing).toBe(true);
});

it('future session with note+png: not done, no screenshotMissing', () => {
	const lessons = [lesson({ id: '1', date: '2026-12-01', sessionKind: 'class' })];
	const { lessons: out } = match(
		lessons,
		[{ folder: 'lezioni', fileName: '09.md', dateIso: '2026-12-01', durationHours: 5 }],
		[],
		{ lezioni: new Set(['09-screen.png']), extra: new Set() }
	);
	expect(out[0].done).toBe(false);
	expect(out[0].screenshotMissing).toBeUndefined();
	expect(out[0].screenshotRef).toEqual({ folder: 'lezioni', fileName: '09-screen.png' });
});
```

Update **all existing** `matchNotesToLessons` calls to pass context with `todayIso` and PNG sets; fix expectations:

- `marks class session done when...` → add `09-screen.png` to set (use `09.md` in fixture for consistency).
- `hours mismatch... still done` → add paired png.
- `extra sessions use extra folder` → add `01-screen.png` in `extra` set.

- [ ] **Step 3: Run tests — expect FAIL**

Run: `bun run test src/lib/lessonNotes/match.test.ts`

- [ ] **Step 4: Implement match.ts**

```ts
export type ScreenshotIndex = {
	lezioni: Set<string>;
	extra: Set<string>;
};

export type MatchContext = {
	todayIso: string;
	screenshots: ScreenshotIndex;
};

import { screenshotFileNameForNote } from './screenshot';

function isPastSession(dateIso: string, todayIso: string): boolean {
	return dateIso <= todayIso;
}

// Inside map callback, replace done: true block:
const note = notes[0];
const pngName = screenshotFileNameForNote(note.fileName);
const pngSet = folder === 'lezioni' ? ctx.screenshots.lezioni : ctx.screenshots.extra;
const hasPng = pngName !== null && pngSet.has(pngName);
const past = isPastSession(lesson.date, ctx.todayIso);

const row: EnrichedLesson = {
	...lesson,
	done: past && hasPng,
	matchedNote: { folder, fileName: note.fileName }
};
if (hasPng && pngName) {
	row.screenshotRef = { folder, fileName: pngName };
}
if (past && !hasPng) {
	row.screenshotMissing = true;
}

// When notes.length === 0:
if (past) {
	return { ...lesson, done: false, screenshotMissing: true };
}
return { ...lesson, done: false };
```

Signature:

```ts
export function matchNotesToLessons(
	lessons: LessonRow[],
	lezioniNotes: ScannedNote[],
	extraNotes: ScannedNote[],
	ctx: MatchContext
): MatchResult
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `bun run test src/lib/lessonNotes/match.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/lib/lessonNotes/types.ts src/lib/lessonNotes/match.ts src/lib/lessonNotes/match.test.ts
git commit -m "feat(lessonNotes): done requires note and paired screenshot"
```

---

### Task 4: Wire enrich + flush path

**Files:**
- Modify: `src/lib/lessonNotes/enrich.ts`

- [ ] **Step 1: Scan PNGs in parallel with notes**

```ts
import { scanScreenshotsSubdir } from './scanFolder';

// inside enrichClassLessonsFromFolder after permission check:
const [lezioni, extra, lezioniPng, extraPng] = await Promise.all([
	scanNotesSubdir(handle, 'lezioni'),
	scanNotesSubdir(handle, 'extra'),
	scanScreenshotsSubdir(handle, 'lezioni'),
	scanScreenshotsSubdir(handle, 'extra')
]);
const matched = matchNotesToLessons(lessons, lezioni.notes, extra.notes, {
	todayIso,
	screenshots: { lezioni: lezioniPng, extra: extraPng }
});
```

- [ ] **Step 2: Run full unit suite**

Run: `bun run test`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/lessonNotes/enrich.ts
git commit -m "feat(lessonNotes): scan screenshot PNGs on class enrich"
```

---

### Task 5: Lazy-load screenshot object URLs

**Files:**
- Create: `src/lib/lessonNotes/loadScreenshot.ts`
- Create: `src/lib/lessonNotes/doneTooltip.ts` (optional — or put `doneColumnTooltip(lesson)` in `screenshot.ts`)

- [ ] **Step 1: Implement `doneColumnTooltip`**

```ts
// src/lib/lessonNotes/doneTooltip.ts
import type { EnrichedLesson } from './types';
import { screenshotFileNameForNote, screenshotPathLabel } from './screenshot';

export function doneColumnTooltip(lesson: EnrichedLesson): string {
	if (lesson.sessionKind === 'skipped') return '';
	if (!lesson.matchedNote) return 'No note for this date';
	const png = screenshotFileNameForNote(lesson.matchedNote.fileName);
	if (!png) return 'No note for this date';
	return `Missing screenshot (expected ${screenshotPathLabel(lesson.matchedNote.folder, png)})`;
}
```

- [ ] **Step 2: Implement loadScreenshot.ts**

```ts
import { getFolderHandle } from '$lib/persistence/meta';
import { hasFolderPermission } from '$lib/persistence/classFolder';
import type { ClassId } from '$lib/db/types';
import type { ScreenshotRef } from './types';

export async function loadScreenshotObjectUrl(
	classId: ClassId,
	ref: ScreenshotRef
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
	const root = await getFolderHandle(classId);
	if (!root || !(await hasFolderPermission(root, 'read'))) {
		return { ok: false, message: 'Folder not available' };
	}
	try {
		const sub = await root.getDirectoryHandle(ref.folder);
		const fileHandle = await sub.getFileHandle(ref.fileName);
		const file = await fileHandle.getFile();
		return { ok: true, url: URL.createObjectURL(file) };
	} catch {
		return { ok: false, message: 'Could not load screenshot' };
	}
}

export function revokeScreenshotObjectUrl(url: string | undefined): void {
	if (url) URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/lessonNotes/doneTooltip.ts src/lib/lessonNotes/loadScreenshot.ts
git commit -m "feat(lessonNotes): screenshot tooltip and lazy file load"
```

---

### Task 6: Sessions table UI

**Files:**
- Modify: `src/routes/class/[classId]/+page.svelte`

- [ ] **Step 1: Add state for expanded rows and loaded URLs**

```ts
import { doneColumnTooltip } from '$lib/lessonNotes/doneTooltip';
import {
	loadScreenshotObjectUrl,
	revokeScreenshotObjectUrl
} from '$lib/lessonNotes/loadScreenshot';
import type { LessonId } from '$lib/db/types';

const COLS = 6;
let expanded = $state<Set<LessonId>>(new Set());
let imageByLesson = $state<Record<string, { url?: string; error?: string; loading?: boolean }>>({});

function toggleExpand(lesson: (typeof data.lessons)[0]) {
	if (!lesson.screenshotRef) return;
	const next = new Set(expanded);
	if (next.has(lesson.id)) {
		next.delete(lesson.id);
		const prev = imageByLesson[lesson.id]?.url;
		revokeScreenshotObjectUrl(prev);
		const { [lesson.id]: _, ...rest } = imageByLesson;
		imageByLesson = rest;
	} else {
		next.add(lesson.id);
		void ensureScreenshotLoaded(lesson.id, lesson.screenshotRef!);
	}
	expanded = next;
}

async function ensureScreenshotLoaded(lessonId: LessonId, ref: ScreenshotRef) {
	if (imageByLesson[lessonId]?.url || imageByLesson[lessonId]?.loading) return;
	imageByLesson = { ...imageByLesson, [lessonId]: { loading: true } };
	const result = await loadScreenshotObjectUrl(data.class.id, ref);
	imageByLesson = {
		...imageByLesson,
		[lessonId]: result.ok
			? { url: result.url }
			: { error: result.message }
	};
}
```

Add `$effect` cleanup on destroy to revoke all URLs in `imageByLesson`.

- [ ] **Step 2: Update table markup**

Wrap each lesson in `{#each}` with two rows:

```svelte
{#each data.lessons as lesson (lesson.id)}
	{@const isExpandable = !!lesson.screenshotRef}
	<tr
		class:upcoming={...}
		class:row-expandable={isExpandable}
		class:row-expanded={expanded.has(lesson.id)}
		aria-expanded={isExpandable ? expanded.has(lesson.id) : undefined}
		onclick={() => isExpandable && toggleExpand(lesson)}
	>
		<!-- cells unchanged except done column -->
		<td class="done-cell">
			{#if lesson.sessionKind === 'skipped'}
				<span class="muted">—</span>
			{:else if lesson.done}
				<span class="done-yes" title="Note and screenshot on disk">✓</span>
				{#if lesson.hoursWarning}<!-- existing warn -->{/if}
			{:else}
				<span class="muted">—</span>
				{#if lesson.screenshotMissing}
					<span class="warn-icon" title={doneColumnTooltip(lesson)}>⚠</span>
				{/if}
			{/if}
		</td>
		<td class="actions" onclick={(e) => e.stopPropagation()}>
			<!-- Open + Delete -->
		</td>
	</tr>
	{#if expanded.has(lesson.id)}
		<tr class="screenshot-detail">
			<td colspan={COLS}>
				{#if imageByLesson[lesson.id]?.loading}
					<p class="muted">Loading…</p>
				{:else if imageByLesson[lesson.id]?.error}
					<p class="warn">{imageByLesson[lesson.id].error}</p>
				{:else if imageByLesson[lesson.id]?.url}
					<img src={imageByLesson[lesson.id].url} alt="Screenshot for {lesson.title}" />
				{/if}
			</td>
		</tr>
	{/if}
{/each}
```

CSS:

```css
tr.row-expandable {
	cursor: pointer;
}
tr.row-expandable:hover {
	background: #f6f8fb;
}
.screenshot-detail img {
	max-width: 100%;
	max-height: 70vh;
	display: block;
}
```

- [ ] **Step 3: Run check + tests**

Run: `bun run check` and `bun run test`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/routes/class/[classId]/+page.svelte
git commit -m "feat(ui): session screenshot warnings and inline preview"
```

---

### Task 7: Lesson detail done copy

**Files:**
- Modify: `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`

- [ ] **Step 1: Import `doneColumnTooltip` and update Done block**

```svelte
{#if data.lesson.sessionKind === 'skipped'}
	<span class="muted">not applicable</span>
{:else if data.lesson.done}
	<strong>Yes</strong> (note and screenshot in {noteFolderLabel})
	{#if data.lesson.hoursWarning}<!-- unchanged -->{/if}
{:else if data.lesson.screenshotMissing}
	<span class="muted">{doneColumnTooltip(data.lesson)}</span>
{:else}
	<span class="muted">No matching note for this date</span>
{/if}
```

- [ ] **Step 2: Run check**

Run: `bun run check`

- [ ] **Step 3: Commit**

```bash
git add src/routes/class/[classId]/lesson/[lessonId]/+page.svelte
git commit -m "feat(ui): lesson detail done reflects screenshot rule"
```

---

### Task 8: README + manual verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add section under file storage / lesson notes**

Document:

- Done = markdown note for session date + `{stem}-screen.png` in same folder.
- Past sessions without screenshot show ⚠ in the sessions list.
- Click row to preview PNG when present.

- [ ] **Step 2: Manual UAT** (linked folder with real files)

1. Past session with `09.md` + `09-screen.png` → ✓, row expands image.
2. Note only → ⚠, not done.
3. Past, no note → ⚠.
4. Future with files → no ✓, no ⚠, row still expandable if PNG exists.
5. Refresh after adding PNG → updates without restart.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: session screenshot pairing and done rule"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Done = note + PNG | 3, 4 |
| Past `screenshotMissing` | 3 |
| Future never done | 3 |
| `lezioni` + `extra` | 3 |
| Done column ⚠ | 6 |
| Row expand + lazy load | 5, 6 |
| Multiple expanded | 6 (Set state) |
| Lesson detail | 7 |
| Semester map via `done` | 3 (no file change) |
| No global warning for screenshots | (no task) |
| flush re-enrich | 4 (automatic) |

## Self-review

- All spec rows mapped.
- No TBD placeholders.
- `MatchContext` / `ScreenshotRef` names consistent throughout.
- Existing tests updated in Task 3 (not left broken).
