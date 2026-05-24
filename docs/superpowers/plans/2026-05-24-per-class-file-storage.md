# Per-class file storage — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist each class to `planner.json` in a user-chosen directory via the File System Access API, with Dexie as the working store, debounced auto-save, and a setup flow for existing IndexedDB classes.

**Architecture:** Zod schemas for `planner.json` and legacy backup JSON. Dexie v4 `classFolders` meta stores per-class `FileSystemDirectoryHandle`. **`src/lib/application/`** orchestrates repo writes then `notifyClassDirty(classId)` (backend-style use-case layer). **`runMutation`** stays UI-only (retry, invalidate, toast). Shared UI state uses **Svelte 5 runes** in `.svelte.ts` modules (`toast`, `saveStatus`), not `writable` stores.

**Tech Stack:** SvelteKit 2, Svelte 5, Dexie 4, Zod, File System Access API, Vitest, Bun

**Plan revisions (2026-05-24):** Zod validation; runes for toast/saveStatus; application layer (A′) instead of `persistClassIds` on `runMutation`; `/restore` shares Zod schemas.

**Spec:** `docs/superpowers/specs/2026-05-24-per-class-file-storage-design.md`

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/schemas/rows.ts` | **Create** | Zod schemas for `ClassRow`, `StudentRow`, `LessonRow`, `AbsenceRow` |
| `src/lib/schemas/plannerFile.ts` | **Create** | `plannerFileSchema` + FK refinements |
| `src/lib/schemas/legacyBackup.ts` | **Create** | Monolithic four-array backup schema (for `/restore`) |
| `src/lib/schemas/*.test.ts` | **Create** | Parse/round-trip tests |
| `src/lib/persistence/plannerFile.ts` | **Create** | `parsePlannerFile`, `serializePlannerFile` (thin Zod wrappers) |
| `src/lib/persistence/snapshot.ts` | **Create** | Read class slice from Dexie → validated object |
| `src/lib/persistence/classFolder.ts` | **Create** | FSA read/write `planner.json`, permissions |
| `src/lib/persistence/meta.ts` | **Create** | CRUD for `classFolders` table |
| `src/lib/persistence/hydrate.ts` | **Create** | Replace one class in Dexie from parsed file |
| `src/lib/persistence/notify.ts` | **Create** | `notifyClassDirty(classId)` → debounced flush |
| `src/lib/persistence/flush.ts` | **Create** | Debounced per-class flush queue |
| `src/lib/persistence/setup.ts` | **Create** | `getUnlinkedClassIds`, `needsSetup`, FSA support check |
| `src/lib/persistence/linkClass.ts` | **Create** | Pick folder + write initial file + save meta |
| `src/lib/ui/toast.svelte.ts` | **Create** | Runes-based toast (`showToast`, `getToastMessage`) |
| `src/lib/ui/saveStatus.svelte.ts` | **Create** | Runes-based save indicator state |
| `src/lib/application/classes.ts` | **Create** | Create/update/delete class + `notifyClassDirty` |
| `src/lib/application/lessons.ts` | **Create** | Lesson mutations + notify |
| `src/lib/application/students.ts` | **Create** | Student mutations + notify |
| `src/lib/application/attendance.ts` | **Create** | `setAbsent` + notify |
| `src/lib/db/types.ts` | **Modify** | Add `ClassFolderMetaRow` |
| `src/lib/db/client.ts` | **Modify** | Dexie v4 `classFolders` table |
| `src/lib/kit/runMutation.ts` | **Modify** | Import toast from `$lib/ui/toast.svelte.ts` only |
| `src/lib/stores/toast.ts` | **Delete** | Replaced by `toast.svelte.ts` |
| `src/routes/**/*.svelte` | **Modify** | Import application layer + runes toast (not repos for writes) |
| `src/routes/restore/+page.svelte` | **Modify** | Use `parseLegacyBackup` from Zod schemas |
| `src/routes/+layout.ts` | **Modify** | FSA check, setup redirect, hydrate |
| `src/routes/setup/+page.svelte` | **Create** | Link folders for unlinked classes |
| `README.md` | **Modify** | Folder-per-class + Chrome/Edge note |

Routes call **`application/*`** inside `runMutation({ fn })`. Repos stay Dexie-only.

---

### Task 0: Zod dependency + runes UI modules

**Files:**
- Modify: `package.json` (via `bun add zod`)
- Create: `src/lib/ui/toast.svelte.ts`
- Create: `src/lib/ui/saveStatus.svelte.ts`
- Modify: `src/lib/kit/runMutation.ts`
- Modify: `src/lib/kit/runMutation.test.ts`
- Modify: `src/routes/+layout.svelte`
- Delete: `src/lib/stores/toast.ts`

- [ ] **Step 1: Install Zod**

```bash
bun add zod
```

- [ ] **Step 2: Create `toast.svelte.ts`**

```ts
// src/lib/ui/toast.svelte.ts
let message = $state<string | null>(null);
let hideTimer: ReturnType<typeof setTimeout> | undefined;

export function getToastMessage(): string | null {
	return message;
}

export function showToast(text: string, ms = 4000): void {
	message = text;
	if (hideTimer) clearTimeout(hideTimer);
	hideTimer = setTimeout(() => {
		message = null;
	}, ms);
}
```

- [ ] **Step 3: Create `saveStatus.svelte.ts`**

```ts
// src/lib/ui/saveStatus.svelte.ts
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

let status = $state<SaveStatus>('idle');

export function getSaveStatus(): SaveStatus {
	return status;
}

export function setSaveStatus(next: SaveStatus): void {
	status = next;
}
```

- [ ] **Step 4: Point `runMutation` at `$lib/ui/toast.svelte.ts`; update test mock path**

- [ ] **Step 5: In `+layout.svelte`, replace `$toastMessage` store with runes:**

```svelte
import { getToastMessage } from '$lib/ui/toast.svelte.ts';

const toast = $derived(getToastMessage());

{#if toast}
	<div class="toast" role="status">{toast}</div>
{/if}
```

Update other files importing `$lib/stores/toast` → `$lib/ui/toast.svelte.ts` (grep).

- [ ] **Step 6: Delete `src/lib/stores/toast.ts`; run `bun run check && bun run test`**

- [ ] **Step 7: Commit**

```bash
git add package.json bun.lock src/lib/ui/ src/lib/kit/ src/routes/
git rm src/lib/stores/toast.ts
git commit -m "refactor: zod dep and runes-based toast/saveStatus modules"
```

---

### Task 1: Zod schemas + planner file helpers

**Files:**
- Create: `src/lib/schemas/rows.ts`
- Create: `src/lib/schemas/plannerFile.ts`
- Create: `src/lib/schemas/legacyBackup.ts`
- Create: `src/lib/schemas/plannerFile.test.ts`
- Create: `src/lib/persistence/plannerFile.ts`

- [ ] **Step 1: Row schemas (`rows.ts`)**

```ts
import { z } from 'zod';

export const lessonSessionKindSchema = z.enum(['class', 'extra', 'skipped']);

export const classRowSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	totalHoursTarget: z.number().finite(),
	requiredStudentLessonHours: z.number().finite(),
	createdAt: z.number().finite(),
	semesterStart: z.string().nullable(),
	semesterEnd: z.string().nullable()
});

export const studentRowSchema = z.object({
	id: z.string().min(1),
	classId: z.string().min(1),
	name: z.string().min(1)
});

export const lessonRowSchema = z.object({
	id: z.string().min(1),
	classId: z.string().min(1),
	date: z.string().min(1),
	durationHours: z.number().finite(),
	title: z.string(),
	done: z.boolean(),
	sessionKind: lessonSessionKindSchema.default('class')
});

export const absenceRowSchema = z.object({
	id: z.string().min(1),
	lessonId: z.string().min(1),
	studentId: z.string().min(1)
});
```

- [ ] **Step 2: `plannerFileSchema` with FK refinements (`schemas/plannerFile.ts`)**

```ts
import { z } from 'zod';
import {
	absenceRowSchema,
	classRowSchema,
	lessonRowSchema,
	studentRowSchema
} from './rows';

export const plannerFileSchema = z
	.object({
		version: z.literal(1),
		class: classRowSchema,
		students: z.array(studentRowSchema),
		lessons: z.array(lessonRowSchema),
		absences: z.array(absenceRowSchema)
	})
	.superRefine((data, ctx) => {
		const classId = data.class.id;
		for (const [i, s] of data.students.entries()) {
			if (s.classId !== classId) {
				ctx.addIssue({ code: 'custom', message: 'student classId mismatch', path: ['students', i, 'classId'] });
			}
		}
		for (const [i, l] of data.lessons.entries()) {
			if (l.classId !== classId) {
				ctx.addIssue({ code: 'custom', message: 'lesson classId mismatch', path: ['lessons', i, 'classId'] });
			}
		}
		const lessonIds = new Set(data.lessons.map((l) => l.id));
		const studentIds = new Set(data.students.map((s) => s.id));
		for (const [i, a] of data.absences.entries()) {
			if (!lessonIds.has(a.lessonId) || !studentIds.has(a.studentId)) {
				ctx.addIssue({ code: 'custom', message: 'invalid absence reference', path: ['absences', i] });
			}
		}
	});

export type PlannerFileV1 = z.infer<typeof plannerFileSchema>;
```

- [ ] **Step 3: `legacyBackupSchema` (`schemas/legacyBackup.ts`)** — same row schemas, top-level four arrays, cross-array FK checks (port logic from `/restore`).

```ts
export const legacyBackupSchema = z
	.object({
		classes: z.array(classRowSchema),
		students: z.array(studentRowSchema),
		lessons: z.array(lessonRowSchema),
		absences: z.array(absenceRowSchema)
	})
	.superRefine(/* classIds, lessonIds, studentIds sets — same rules as restore page */);
export type LegacyBackup = z.infer<typeof legacyBackupSchema>;
```

- [ ] **Step 4: Tests + thin persistence wrapper**

```ts
// src/lib/persistence/plannerFile.ts
import { plannerFileSchema, type PlannerFileV1 } from '$lib/schemas/plannerFile';

const INVALID = 'Could not load planner.json — file may be damaged.';

export type ParseResult =
	| { ok: true; value: PlannerFileV1 }
	| { ok: false; message: string };

export function parsePlannerFile(json: unknown): ParseResult {
	const r = plannerFileSchema.safeParse(json);
	if (!r.success) return { ok: false, message: INVALID };
	return { ok: true, value: r.data };
}

export function serializePlannerFile(data: PlannerFileV1): string {
	return JSON.stringify(data, null, 2);
}

export function parseLegacyBackup(json: unknown): ParseResult & { ok: false; message: string } | { ok: true; value: LegacyBackup } {
	// use legacyBackupSchema.safeParse; map errors to restore page messages
}
```

- [ ] **Step 5: Run tests, commit**

```bash
bun run test src/lib/schemas src/lib/persistence/plannerFile.test.ts
git add src/lib/schemas src/lib/persistence/plannerFile.ts
git commit -m "feat: zod schemas for planner.json and legacy backup"
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

### Task 6: `notifyClassDirty` + debounced flush

**Files:**
- Create: `src/lib/persistence/notify.ts`
- Create: `src/lib/persistence/flush.ts`

*(Save status runes module created in Task 0.)*

- [ ] **Step 1: `notify.ts`**

```ts
import { scheduleClassFlush } from './flush';
import type { ClassId } from '$lib/db/types';

export function notifyClassDirty(classId: ClassId): void {
	scheduleClassFlush(classId);
}
```

- [ ] **Step 2: `flush.ts`** — import `setSaveStatus` from `$lib/ui/saveStatus.svelte.ts`, `showToast` from `$lib/ui/toast.svelte.ts` (same debounced `flushClassNow` logic as before).

- [ ] **Step 3: Commit**

```bash
git add src/lib/persistence/notify.ts src/lib/persistence/flush.ts
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

### Task 8: Application layer (use-cases)

**Files:**
- Create: `src/lib/application/classes.ts`
- Create: `src/lib/application/lessons.ts`
- Create: `src/lib/application/students.ts`
- Create: `src/lib/application/attendance.ts`
- Create: `src/lib/application/classes.test.ts` (optional: mock `notifyClassDirty`)

**Pattern:** each function delegates to the matching `*.repo.ts`, then calls `notifyClassDirty(classId)` when data for that class changed.

- [ ] **Step 1: `classes.ts`**

```ts
import * as classesRepo from '$lib/repos/classes.repo';
import { notifyClassDirty } from '$lib/persistence/notify';
import { removeFolderHandle } from '$lib/persistence/meta';
import type { ClassId, ClassRow } from '$lib/db/types';

export async function createClass(input: Parameters<typeof classesRepo.createClass>[0]): Promise<ClassRow> {
	const row = await classesRepo.createClass(input);
	notifyClassDirty(row.id);
	return row;
}

export async function updateClass(id: ClassId, patch: Parameters<typeof classesRepo.updateClass>[1]): Promise<void> {
	await classesRepo.updateClass(id, patch);
	notifyClassDirty(id);
}

export async function deleteClassCascade(id: ClassId): Promise<void> {
	await classesRepo.deleteClassCascade(id);
	await removeFolderHandle(id); // untrack handle only; no disk delete
}
```

- [ ] **Step 2: `lessons.ts`** — wrap `createLesson`, `updateLesson`, `deleteLessonCascade`; resolve `classId` from input or `getLesson` after update; `notifyClassDirty(classId)`.

- [ ] **Step 3: `students.ts`** — wrap all mutators; `notifyClassDirty(classId)`.

- [ ] **Step 4: `attendance.ts`** — wrap `setAbsent`; load lesson for `classId`, then notify.

- [ ] **Step 5: `createClassAndLinkFolder`** (in `classes.ts` or `linkClass.ts`): `createClass` → `pickClassFolder` → `linkClassToPickedFolder` → on link failure `deleteClassCascade` + throw.

- [ ] **Step 6: Run tests, commit**

```bash
git add src/lib/application/
git commit -m "feat: application layer with file sync after repo writes"
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

- [ ] **Step 2: `onNewClass`** — use `createClassAndLinkFolder` from application layer inside `runMutation`.

- [ ] **Step 3: `onDeleteClass`** — `application/deleteClassCascade` (meta removed inside application).

- [ ] **Step 4: Save indicator in header** — `$derived(getSaveStatus())`, show muted “Saving…” / “Saved” / “Save failed”.

- [ ] **Step 5: Commit**

```bash
git add src/routes/+layout.ts src/routes/+layout.svelte
git commit -m "feat: layout hydrate, setup redirect, create class with folder"
```

---

### Task 11: Routes use application layer for writes

**Files:** Replace `$lib/repos/*` imports with `$lib/application/*` for **mutations only** (loads keep repos).

- `src/routes/+layout.svelte` — `createClassAndLinkFolder`, `updateClass`, `deleteClassCascade`
- `src/routes/class/[classId]/+page.svelte`
- `src/routes/class/[classId]/students/+page.svelte`
- `src/routes/class/[classId]/SemesterMap.svelte`
- `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`

- [ ] **Step 1: Grep `from '$lib/repos/` in routes; switch mutators to application**

Example:

```ts
import { updateLesson } from '$lib/application/lessons';

await runMutation({
	fn: () => updateLesson(id, patch),
	invalidate: classLessonsLoadKey(params.classId)
});
```

- [ ] **Step 2: Run full test suite**

Run: `bun run test && bun run check`

- [ ] **Step 3: Commit**

```bash
git add src/routes/
git commit -m "refactor: route mutations through application layer for file sync"
```

---

### Task 11b: Refactor `/restore` to Zod

**Files:**
- Modify: `src/routes/restore/+page.svelte`

- [ ] **Step 1: Remove inline `parseClassRow` / `parseBackup` helpers**

- [ ] **Step 2: Use `parseLegacyBackup(json)` from `$lib/persistence/plannerFile.ts` (or `$lib/schemas/legacyBackup.ts`); map `ok: false` messages to existing UI strings.

- [ ] **Step 3: Manual test with `lesson-planner-legacy-backup-*.json`; commit**

```bash
git add src/routes/restore/+page.svelte
git commit -m "refactor: validate legacy backup with shared zod schemas"
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
| Keep Dexie working store | Repos unchanged; application wraps writes |
| Per-class folder pick | 7, 9, 10 |
| Remember handles | 2, 3 |
| Debounced auto-save | 6, 8, 11 |
| Export/setup for existing IDB | 9 |
| planner.json v1 + version | 1 (Zod) |
| Folder required at create | 8, 10 |
| Delete = untrack only | 8 (`deleteClassCascade`) |
| Rename JSON only | 1 (class row in file) |
| No external file watch | Non-goal (omitted) |
| FSA browser gating | 7, 9, 10 |
| Error messages | 1, 4, 6, 9 |
| Legacy `/restore` | 11b (shared Zod) |
| Runes UI state | 0 |
| Application layer (A′) | 8, 11 |

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-24-per-class-file-storage.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement in this session with executing-plans checkpoints  

Which approach do you want?
