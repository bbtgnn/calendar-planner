# Per-class file storage — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist each class to `planner.json` in a user-chosen directory via the File System Access API, with Dexie as the working store, debounced auto-save, and a setup flow for existing IndexedDB classes.

**Architecture:** Pure `planner.json` serialize/parse/validate module (tested). Dexie v4 adds a `classFolders` meta table for `FileSystemDirectoryHandle`. On layout load, hydrate Dexie from files when all classes are linked; otherwise redirect to `/setup`. `runMutation` schedules debounced per-class flushes after successful writes.

**Tech Stack:** SvelteKit 2, Svelte 5, Dexie 4, File System Access API, Vitest, Bun

**Spec:** `docs/superpowers/specs/2026-05-24-per-class-file-storage-design.md`

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/persistence/plannerFile.ts` | **Create** | Parse/serialize/validate `planner.json` v1 |
| `src/lib/persistence/plannerFile.test.ts` | **Create** | Unit tests |
| `src/lib/persistence/snapshot.ts` | **Create** | Read class slice from Dexie → `PlannerFileV1` |
| `src/lib/persistence/snapshot.test.ts` | **Create** | Snapshot tests with fake-indexeddb |
| `src/lib/persistence/classFolder.ts` | **Create** | FSA read/write `planner.json`, permissions |
| `src/lib/persistence/meta.ts` | **Create** | CRUD for `classFolders` table |
| `src/lib/persistence/hydrate.ts` | **Create** | Replace one class in Dexie from parsed file |
| `src/lib/persistence/flush.ts` | **Create** | Debounced per-class flush queue |
| `src/lib/persistence/setup.ts` | **Create** | `getUnlinkedClassIds`, `isFileStorageSupported`, `linkClassFolder` |
| `src/lib/persistence/linkClass.ts` | **Create** | Pick folder + write initial file + save meta |
| `src/lib/stores/saveStatus.ts` | **Create** | `idle` \| `saving` \| `saved` \| `failed` |
| `src/lib/db/types.ts` | **Modify** | Add `ClassFolderMetaRow` |
| `src/lib/db/client.ts` | **Modify** | Dexie v4 `classFolders` table |
| `src/lib/kit/runMutation.ts` | **Modify** | Optional `persistClassIds` → schedule flush |
| `src/lib/kit/runMutation.test.ts` | **Modify** | Mock flush scheduler |
| `src/routes/+layout.ts` | **Modify** | FSA check, setup redirect, hydrate |
| `src/routes/+layout.svelte` | **Modify** | Create class + folder, save indicator, delete meta |
| `src/routes/setup/+page.svelte` | **Create** | Link folders for unlinked classes |
| `src/routes/setup/+page.ts` | **Create** | Load unlinked class list |
| `src/routes/class/[classId]/+layout.svelte` | **Modify** | Reconnect banner when permission lost |
| `README.md` | **Modify** | Folder-per-class + Chrome/Edge note |

All `runMutation` call sites in routes get `persistClassIds` (see Task 10).

---

### Task 1: `planner.json` types and validation

**Files:**
- Create: `src/lib/persistence/plannerFile.ts`
- Create: `src/lib/persistence/plannerFile.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/persistence/plannerFile.test.ts
import { describe, expect, it } from 'vitest';
import { parsePlannerFile, serializePlannerFile, type PlannerFileV1 } from './plannerFile';

const sample: PlannerFileV1 = {
	version: 1,
	class: {
		id: 'c1',
		name: 'Math',
		totalHoursTarget: 40,
		requiredStudentLessonHours: 0,
		createdAt: 1,
		semesterStart: null,
		semesterEnd: null
	},
	students: [{ id: 's1', classId: 'c1', name: 'Ada' }],
	lessons: [
		{
			id: 'l1',
			classId: 'c1',
			date: '2026-01-15',
			durationHours: 2,
			title: 'Intro',
			done: false,
			sessionKind: 'class'
		}
	],
	absences: []
};

describe('plannerFile', () => {
	it('round-trips serialize and parse', () => {
		const json = serializePlannerFile(sample);
		const parsed = parsePlannerFile(JSON.parse(json));
		expect(parsed.ok).toBe(true);
		if (parsed.ok) expect(parsed.value).toEqual(sample);
	});

	it('rejects wrong version', () => {
		const r = parsePlannerFile({ ...sample, version: 99 });
		expect(r.ok).toBe(false);
	});

	it('rejects student with wrong classId', () => {
		const bad = {
			...sample,
			students: [{ id: 's1', classId: 'other', name: 'Ada' }]
		};
		const r = parsePlannerFile(bad);
		expect(r.ok).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `bun run test src/lib/persistence/plannerFile.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement `plannerFile.ts`**

```ts
// src/lib/persistence/plannerFile.ts
import type { AbsenceRow, ClassRow, LessonRow, LessonSessionKind, StudentRow } from '$lib/db/types';

export const PLANNER_FILE_VERSION = 1;
export const PLANNER_FILE_NAME = 'planner.json';

export type PlannerFileV1 = {
	version: 1;
	class: ClassRow;
	students: StudentRow[];
	lessons: LessonRow[];
	absences: AbsenceRow[];
};

export type ParseResult =
	| { ok: true; value: PlannerFileV1 }
	| { ok: false; message: string };

const SESSION_KINDS = new Set<LessonSessionKind>(['class', 'extra', 'skipped']);

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function requireString(obj: Record<string, unknown>, key: string): string | null {
	const v = obj[key];
	return typeof v === 'string' && v.length > 0 ? v : null;
}

function requireNumber(obj: Record<string, unknown>, key: string): number | null {
	const v = obj[key];
	return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function requireBoolean(obj: Record<string, unknown>, key: string): boolean | null {
	const v = obj[key];
	return typeof v === 'boolean' ? v : null;
}

function parseClassRow(raw: unknown): ClassRow | null {
	if (!isRecord(raw)) return null;
	const id = requireString(raw, 'id');
	const name = requireString(raw, 'name');
	const totalHoursTarget = requireNumber(raw, 'totalHoursTarget');
	const createdAt = requireNumber(raw, 'createdAt');
	if (!id || !name || totalHoursTarget === null || createdAt === null) return null;
	const requiredStudentLessonHours = requireNumber(raw, 'requiredStudentLessonHours') ?? 0;
	const semesterStart =
		raw.semesterStart === null || raw.semesterStart === undefined
			? null
			: requireString(raw, 'semesterStart');
	const semesterEnd =
		raw.semesterEnd === null || raw.semesterEnd === undefined
			? null
			: requireString(raw, 'semesterEnd');
	if (raw.semesterStart !== undefined && raw.semesterStart !== null && semesterStart === null)
		return null;
	if (raw.semesterEnd !== undefined && raw.semesterEnd !== null && semesterEnd === null)
		return null;
	return {
		id,
		name,
		totalHoursTarget,
		requiredStudentLessonHours,
		createdAt,
		semesterStart,
		semesterEnd
	};
}

function parseStudentRow(raw: unknown): StudentRow | null {
	if (!isRecord(raw)) return null;
	const id = requireString(raw, 'id');
	const classId = requireString(raw, 'classId');
	const name = requireString(raw, 'name');
	if (!id || !classId || !name) return null;
	return { id, classId, name };
}

function parseLessonRow(raw: unknown): LessonRow | null {
	if (!isRecord(raw)) return null;
	const id = requireString(raw, 'id');
	const classId = requireString(raw, 'classId');
	const date = requireString(raw, 'date');
	const durationHours = requireNumber(raw, 'durationHours');
	const title = requireString(raw, 'title');
	const done = requireBoolean(raw, 'done');
	if (!id || !classId || !date || durationHours === null || title === null || done === null)
		return null;
	const kindRaw = raw.sessionKind;
	const sessionKind =
		typeof kindRaw === 'string' && SESSION_KINDS.has(kindRaw as LessonSessionKind)
			? (kindRaw as LessonSessionKind)
			: 'class';
	return { id, classId, date, durationHours, title, done, sessionKind };
}

function parseAbsenceRow(raw: unknown): AbsenceRow | null {
	if (!isRecord(raw)) return null;
	const id = requireString(raw, 'id');
	const lessonId = requireString(raw, 'lessonId');
	const studentId = requireString(raw, 'studentId');
	if (!id || !lessonId || !studentId) return null;
	return { id, lessonId, studentId };
}

const INVALID_SHAPE = 'Could not load planner.json — file may be damaged.';
const INVALID_REFS = 'Could not load planner.json — invalid references inside file.';

export function parsePlannerFile(json: unknown): ParseResult {
	if (!isRecord(json)) return { ok: false, message: INVALID_SHAPE };
	if (json.version !== PLANNER_FILE_VERSION) return { ok: false, message: INVALID_SHAPE };

	const classRow = parseClassRow(json.class);
	if (!classRow) return { ok: false, message: INVALID_SHAPE };

	if (!Array.isArray(json.students) || !Array.isArray(json.lessons) || !Array.isArray(json.absences)) {
		return { ok: false, message: INVALID_SHAPE };
	}

	const students: StudentRow[] = [];
	for (const raw of json.students) {
		const row = parseStudentRow(raw);
		if (!row || row.classId !== classRow.id) return { ok: false, message: INVALID_REFS };
		students.push(row);
	}

	const studentIds = new Set(students.map((s) => s.id));

	const lessons: LessonRow[] = [];
	for (const raw of json.lessons) {
		const row = parseLessonRow(raw);
		if (!row || row.classId !== classRow.id) return { ok: false, message: INVALID_REFS };
		lessons.push(row);
	}

	const lessonIds = new Set(lessons.map((l) => l.id));

	const absences: AbsenceRow[] = [];
	for (const raw of json.absences) {
		const row = parseAbsenceRow(raw);
		if (!row) return { ok: false, message: INVALID_SHAPE };
		if (!lessonIds.has(row.lessonId) || !studentIds.has(row.studentId)) {
			return { ok: false, message: INVALID_REFS };
		}
		absences.push(row);
	}

	return {
		ok: true,
		value: { version: 1, class: classRow, students, lessons, absences }
	};
}

export function serializePlannerFile(data: PlannerFileV1): string {
	return JSON.stringify(data, null, 2);
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `bun run test src/lib/persistence/plannerFile.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/persistence/plannerFile.ts src/lib/persistence/plannerFile.test.ts
git commit -m "feat: add planner.json parse and serialize"
```

---

### Task 2: Dexie meta table for directory handles

**Files:**
- Modify: `src/lib/db/types.ts`
- Modify: `src/lib/db/client.ts`
- Modify: `src/lib/db/client.smoke.test.ts` (if version assertion exists)

- [ ] **Step 1: Add type**

```ts
// src/lib/db/types.ts — append
export type ClassFolderMetaRow = {
	classId: ClassId;
	directoryHandle: FileSystemDirectoryHandle;
	linkedAt: number;
	lastSyncedAt?: number;
};
```

- [ ] **Step 2: Add Dexie v4**

```ts
// src/lib/db/client.ts — add import ClassFolderMetaRow, add to class:
classFolders!: Table<ClassFolderMetaRow, string>;

// after version(3) block:
this.version(4).stores({
	classes: 'id, name, createdAt',
	students: 'id, classId, name',
	lessons: 'id, classId, date, done, sessionKind',
	absences: 'id, lessonId, studentId',
	classFolders: 'classId'
});
```

- [ ] **Step 3: Run check + smoke test**

Run: `bun run check && bun run test src/lib/db/client.smoke.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/types.ts src/lib/db/client.ts
git commit -m "feat: add classFolders meta table for directory handles"
```

---

### Task 3: Meta repository

**Files:**
- Create: `src/lib/persistence/meta.ts`
- Create: `src/lib/persistence/meta.test.ts`

- [ ] **Step 1: Write test**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/db/client';
import { getFolderHandle, listFolderClassIds, putFolderHandle, removeFolderHandle } from './meta';

describe('meta', () => {
	beforeEach(async () => {
		await db.delete();
		await db.open();
	});

	it('put and get handle', async () => {
		const handle = { kind: 'directory' } as FileSystemDirectoryHandle;
		await putFolderHandle('c1', handle);
		expect(await getFolderHandle('c1')).toBe(handle);
		expect(await listFolderClassIds()).toEqual(['c1']);
		await removeFolderHandle('c1');
		expect(await getFolderHandle('c1')).toBeUndefined();
	});
});
```

- [ ] **Step 2: Implement**

```ts
import { db } from '$lib/db/client';
import type { ClassId, ClassFolderMetaRow } from '$lib/db/types';

export async function listFolderClassIds(): Promise<ClassId[]> {
	return db.classFolders.toCollection().primaryKeys();
}

export async function getFolderHandle(classId: ClassId): Promise<FileSystemDirectoryHandle | undefined> {
	const row = await db.classFolders.get(classId);
	return row?.directoryHandle;
}

export async function putFolderHandle(classId: ClassId, directoryHandle: FileSystemDirectoryHandle): Promise<void> {
	const row: ClassFolderMetaRow = {
		classId,
		directoryHandle,
		linkedAt: Date.now()
	};
	await db.classFolders.put(row);
}

export async function touchFolderSynced(classId: ClassId): Promise<void> {
	await db.classFolders.update(classId, { lastSyncedAt: Date.now() });
}

export async function removeFolderHandle(classId: ClassId): Promise<void> {
	await db.classFolders.delete(classId);
}
```

- [ ] **Step 3: Run test, commit**

Run: `bun run test src/lib/persistence/meta.test.ts`

```bash
git add src/lib/persistence/meta.ts src/lib/persistence/meta.test.ts
git commit -m "feat: add class folder meta persistence"
```

---

### Task 4: Dexie snapshot + FSA file I/O

**Files:**
- Create: `src/lib/persistence/snapshot.ts`
- Create: `src/lib/persistence/snapshot.test.ts`
- Create: `src/lib/persistence/classFolder.ts`

- [ ] **Step 1: `snapshot.ts` — load class slice**

```ts
import { db } from '$lib/db/client';
import type { ClassId } from '$lib/db/types';
import type { PlannerFileV1 } from './plannerFile';
import { PLANNER_FILE_VERSION } from './plannerFile';
import { RepoErrorCode, repoError } from '$lib/kit/repoErrors';

export async function loadClassSnapshot(classId: ClassId): Promise<PlannerFileV1> {
	const classRow = await db.classes.get(classId);
	if (!classRow) throw repoError(RepoErrorCode.CLASS_NOT_FOUND);
	const students = await db.students.where('classId').equals(classId).toArray();
	const lessons = await db.lessons.where('classId').equals(classId).toArray();
	const lessonIds = lessons.map((l) => l.id);
	const absences =
		lessonIds.length === 0
			? []
			: await db.absences.where('lessonId').anyOf(lessonIds).toArray();
	return {
		version: PLANNER_FILE_VERSION,
		class: classRow,
		students,
		lessons,
		absences
	};
}
```

- [ ] **Step 2: `classFolder.ts`**

```ts
import { parsePlannerFile, serializePlannerFile, PLANNER_FILE_NAME, type PlannerFileV1 } from './plannerFile';

export function isFileStorageSupported(): boolean {
	return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function ensureReadWritePermission(
	handle: FileSystemDirectoryHandle
): Promise<boolean> {
	const opts = { mode: 'readwrite' as const };
	if ((await handle.queryPermission(opts)) === 'granted') return true;
	return (await handle.requestPermission(opts)) === 'granted';
}

export async function readPlannerFile(
	handle: FileSystemDirectoryHandle
): Promise<{ ok: true; value: PlannerFileV1 } | { ok: false; message: string }> {
	const fileHandle = await handle.getFileHandle(PLANNER_FILE_NAME);
	const file = await fileHandle.getFile();
	const text = await file.text();
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		return { ok: false, message: 'Could not load planner.json — file may be damaged.' };
	}
	return parsePlannerFile(json);
}

export async function writePlannerFile(
	handle: FileSystemDirectoryHandle,
	data: PlannerFileV1
): Promise<void> {
	const fileHandle = await handle.getFileHandle(PLANNER_FILE_NAME, { create: true });
	const writable = await fileHandle.createWritable();
	await writable.write(serializePlannerFile(data));
	await writable.close();
}
```

- [ ] **Step 3: Snapshot test** (create class + lesson in Dexie, assert snapshot shape)

- [ ] **Step 4: Commit**

```bash
git add src/lib/persistence/snapshot.ts src/lib/persistence/snapshot.test.ts src/lib/persistence/classFolder.ts
git commit -m "feat: add class snapshot and folder file I/O"
```

---

### Task 5: Hydrate Dexie from file

**Files:**
- Create: `src/lib/persistence/hydrate.ts`

- [ ] **Step 1: Implement replace-class transaction**

```ts
import { db } from '$lib/db/client';
import type { ClassId } from '$lib/db/types';
import type { PlannerFileV1 } from './plannerFile';

export async function hydrateClassFromFile(classId: ClassId, file: PlannerFileV1): Promise<void> {
	if (file.class.id !== classId) {
		throw new Error('Planner file class id does not match');
	}
	await db.transaction('rw', db.classes, db.students, db.lessons, db.absences, async () => {
		const lessonIds = (await db.lessons.where('classId').equals(classId).primaryKeys()) as string[];
		const studentIds = (await db.students.where('classId').equals(classId).primaryKeys()) as string[];
		if (lessonIds.length > 0) {
			await db.absences.where('lessonId').anyOf(lessonIds).delete();
		}
		await db.lessons.where('classId').equals(classId).delete();
		await db.students.where('classId').equals(classId).delete();
		await db.classes.delete(classId);

		await db.classes.add(file.class);
		if (file.students.length) await db.students.bulkAdd(file.students);
		if (file.lessons.length) await db.lessons.bulkAdd(file.lessons);
		if (file.absences.length) await db.absences.bulkAdd(file.absences);
	});
}
```

- [ ] **Step 2: Add `hydrateAllLinkedClassesFromFiles`**

Loop `listFolderClassIds()`, get handle, `ensureReadWritePermission`, `readPlannerFile`, `hydrateClassFromFile`, throw on first error.

- [ ] **Step 3: Commit**

```bash
git add src/lib/persistence/hydrate.ts
git commit -m "feat: hydrate Dexie class rows from planner.json"
```

---

### Task 6: Debounced flush + save status store

**Files:**
- Create: `src/lib/persistence/flush.ts`
- Create: `src/lib/stores/saveStatus.ts`

- [ ] **Step 1: Save status store**

```ts
import { writable } from 'svelte/store';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

export const saveStatus = writable<SaveStatus>('idle');

export function setSaveStatus(status: SaveStatus): void {
	saveStatus.set(status);
}
```

- [ ] **Step 2: Flush module**

```ts
import { loadClassSnapshot } from './snapshot';
import { writePlannerFile } from './classFolder';
import { getFolderHandle, touchFolderSynced } from './meta';
import { setSaveStatus } from '$lib/stores/saveStatus';
import { showToast } from '$lib/stores/toast';
import type { ClassId } from '$lib/db/types';

const DEBOUNCE_MS = 400;
const timers = new Map<ClassId, ReturnType<typeof setTimeout>>();

export function scheduleClassFlush(classId: ClassId): void {
	const prev = timers.get(classId);
	if (prev) clearTimeout(prev);
	timers.set(
		classId,
		setTimeout(() => {
			timers.delete(classId);
			void flushClassNow(classId);
		}, DEBOUNCE_MS)
	);
}

export async function flushClassNow(classId: ClassId): Promise<void> {
	const handle = await getFolderHandle(classId);
	if (!handle) return;
	setSaveStatus('saving');
	try {
		const snapshot = await loadClassSnapshot(classId);
		await writePlannerFile(handle, snapshot);
		await touchFolderSynced(classId);
		setSaveStatus('saved');
	} catch {
		setSaveStatus('failed');
		showToast('Could not save to folder — try again.');
	}
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/persistence/flush.ts src/lib/stores/saveStatus.ts
git commit -m "feat: debounced flush of class data to planner.json"
```

---

### Task 7: Link class + setup helpers

**Files:**
- Create: `src/lib/persistence/linkClass.ts`
- Create: `src/lib/persistence/setup.ts`

- [ ] **Step 1: `setup.ts`**

```ts
import { listClasses } from '$lib/repos/classes.repo';
import { listFolderClassIds } from './meta';
import { isFileStorageSupported } from './classFolder';
import type { ClassId } from '$lib/db/types';

export { isFileStorageSupported };

export async function getUnlinkedClassIds(): Promise<ClassId[]> {
	const classes = await listClasses();
	const linked = new Set(await listFolderClassIds());
	return classes.filter((c) => !linked.has(c.id)).map((c) => c.id);
}

export async function needsSetup(): Promise<boolean> {
	if (!isFileStorageSupported()) return false;
	const classes = await listClasses();
	if (classes.length === 0) return false;
	return (await getUnlinkedClassIds()).length > 0;
}
```

- [ ] **Step 2: `linkClass.ts`**

```ts
import { loadClassSnapshot } from './snapshot';
import { writePlannerFile, ensureReadWritePermission } from './classFolder';
import { putFolderHandle } from './meta';
import type { ClassId } from '$lib/db/types';

export async function pickClassFolder(): Promise<FileSystemDirectoryHandle | null> {
	if (!('showDirectoryPicker' in window)) return null;
	try {
		return await window.showDirectoryPicker();
	} catch {
		return null; // user cancelled
	}
}

export async function linkClassToPickedFolder(classId: ClassId, handle: FileSystemDirectoryHandle): Promise<boolean> {
	if (!(await ensureReadWritePermission(handle))) return false;
	const snapshot = await loadClassSnapshot(classId);
	await writePlannerFile(handle, snapshot);
	await putFolderHandle(classId, handle);
	return true;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/persistence/linkClass.ts src/lib/persistence/setup.ts
git commit -m "feat: add setup and link-class folder helpers"
```

---

### Task 8: Hook `runMutation` persistence

**Files:**
- Modify: `src/lib/kit/runMutation.ts`
- Modify: `src/lib/kit/runMutation.test.ts`

- [ ] **Step 1: Add option and call flush scheduler**

```ts
// Add import
import { scheduleClassFlush } from '$lib/persistence/flush';
import type { ClassId } from '$lib/db/types';

// Extend RunMutationOptions:
persistClassIds?: ClassId | ClassId[];

// After successful onSuccess, before return { ok: true }:
if (options.persistClassIds) {
	const ids = Array.isArray(options.persistClassIds)
		? options.persistClassIds
		: [options.persistClassIds];
	for (const id of ids) scheduleClassFlush(id);
}
```

- [ ] **Step 2: Mock `scheduleClassFlush` in `runMutation.test.ts` and assert called when `persistClassIds` set**

- [ ] **Step 3: Run tests, commit**

```bash
git add src/lib/kit/runMutation.ts src/lib/kit/runMutation.test.ts
git commit -m "feat: schedule file flush after successful mutations"
```

---

### Task 9: Setup route

**Files:**
- Create: `src/routes/setup/+page.ts`
- Create: `src/routes/setup/+page.svelte`

- [ ] **Step 1: Load function**

```ts
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { listClasses } from '$lib/repos/classes.repo';
import { getUnlinkedClassIds, isFileStorageSupported } from '$lib/persistence/setup';

export const load: PageLoad = async () => {
	if (!isFileStorageSupported()) {
		return { unsupported: true as const, classes: [] };
	}
	const unlinked = await getUnlinkedClassIds();
	if (unlinked.length === 0) throw redirect(303, '/');
	const classes = await listClasses();
	return {
		unsupported: false as const,
		classes: classes.filter((c) => unlinked.includes(c.id))
	};
};
```

- [ ] **Step 2: Page UI** — list classes, **Choose folder** per class, calls `pickClassFolder` + `linkClassToPickedFolder`, `invalidateAll` + reload when one linked; when all linked `goto('/')`. Show unsupported browser message when `unsupported`.

- [ ] **Step 3: Manual test `/setup`**, commit

```bash
git add src/routes/setup/
git commit -m "feat: add setup route to link class folders"
```

---

### Task 10: Layout load guard, hydrate, create class, delete meta

**Files:**
- Modify: `src/routes/+layout.ts`
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: `+layout.ts`**

```ts
import { redirect } from '@sveltejs/kit';
import { needsSetup, isFileStorageSupported } from '$lib/persistence/setup';
import { hydrateAllLinkedClassesFromFiles } from '$lib/persistence/hydrate';

export const load: LayoutLoad = async ({ depends, url }) => {
	depends(CLASSES_LIST_LOAD_KEY);
	if (!isFileStorageSupported()) {
		return { classes: await listClasses(), fileStorageUnsupported: true };
	}
	if (url.pathname !== '/setup' && (await needsSetup())) {
		throw redirect(303, '/setup');
	}
	if (!(await needsSetup())) {
		await hydrateAllLinkedClassesFromFiles();
	}
	return { classes: await listClasses(), fileStorageUnsupported: false };
};
```

- [ ] **Step 2: `onNewClass` in layout** — after name prompt, `pickClassFolder()`; if null return; `createClass` then `linkClassToPickedFolder(c.id, handle)`; on link failure toast and delete class from Dexie; else goto class.

- [ ] **Step 3: `onDeleteClass`** — after `deleteClassCascade`, `removeFolderHandle(routeClassId)` in `fn` or `onSuccess`.

- [ ] **Step 4: Save indicator in header** — subscribe `$saveStatus`, show muted “Saving…” / “Saved” / “Save failed”.

- [ ] **Step 5: Commit**

```bash
git add src/routes/+layout.ts src/routes/+layout.svelte
git commit -m "feat: layout hydrate, setup redirect, create class with folder"
```

---

### Task 11: Add `persistClassIds` to all mutation call sites

**Files:** (add `persistClassIds: routeClassId` or appropriate `classId` / `params.classId`)

- `src/routes/+layout.svelte` — rename/update/delete/create flows
- `src/routes/class/[classId]/+page.svelte` — 4 mutations
- `src/routes/class/[classId]/students/+page.svelte` — 5 mutations
- `src/routes/class/[classId]/SemesterMap.svelte` — 2 mutations
- `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte` — 3 mutations

- [ ] **Step 1: Grep and patch each `runMutation`**

Example:

```ts
await runMutation({
	fn: () => updateLesson(id, patch),
	persistClassIds: params.classId,
	invalidate: classLessonsLoadKey(params.classId),
	// ...
});
```

For lesson page attendance, use parent `classId` from `params.classId`.

- [ ] **Step 2: Run full test suite**

Run: `bun run test && bun run check`

- [ ] **Step 3: Commit**

```bash
git add src/routes/
git commit -m "feat: persist class files after all mutations"
```

---

### Task 12: Reconnect banner on class layout

**Files:**
- Modify: `src/routes/class/[classId]/+layout.svelte`
- Modify: `src/routes/class/[classId]/+layout.ts` (optional load flag)

- [ ] **Step 1: On mount/effect**, `getFolderHandle(classId)` + `ensureReadWritePermission`; if false show banner with **Reconnect folder** button → `showDirectoryPicker` + `putFolderHandle` (same classId).

- [ ] **Step 2: Commit**

```bash
git add src/routes/class/[classId]/+layout.svelte
git commit -m "feat: reconnect folder banner when permission lost"
```

---

### Task 13: README and manual verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document** per-class `planner.json`, Chrome/Edge, `/setup` for existing data, debounced save.

- [ ] **Step 2: Manual verification** (from spec)

1. Two classes in IDB, no handles → `/setup` lists both.
2. Link each → two `planner.json` on disk.
3. Edit lesson → file updates after ~400ms.
4. Reload → data matches files.
5. Delete class → IDB + meta cleared; folders remain.
6. Revoke permission → reconnect works.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document per-class folder storage"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| File as source of truth | 5, 10 (hydrate on load) |
| Keep Dexie working store | All repos unchanged |
| Per-class folder pick | 7, 9, 10 |
| Remember handles | 2, 3 |
| Debounced auto-save | 6, 8, 11 |
| Export/setup for existing IDB | 9 |
| planner.json v1 + version | 1 |
| Folder required at create | 10 |
| Delete = untrack only | 10 |
| Rename JSON only | 1 (class row in file) |
| No external file watch | Non-goal (omitted) |
| FSA browser gating | 7, 9, 10 |
| Error messages | 1, 4, 6, 9 |
| `/restore` unchanged | No task (explicit non-change) |

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-24-per-class-file-storage.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement in this session with executing-plans checkpoints  

Which approach do you want?
