# Lesson planner (teacher) implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a browser-only SvelteKit app where teachers manage multiple classes, semester hour targets, dated lessons with per-session hours and completion, student rosters (CRUD + import), absence marks per lesson, and derived stats — persisted with Dexie (IndexedDB).

**Architecture:** Pure **domain logic** (`stats`, roster import) lives in **testable TypeScript modules**. **Dexie** holds **classes**, **students**, **lessons**, and **absence** rows (sparse: only absent pairs). **Repositories** encapsulate CRUD and **cascade deletes**. **SvelteKit** routes stay thin; **`ssr: false`** and **`adapter-static`** with **`fallback: 'index.html'`** make a static SPA. **Active class id** in **`localStorage`**.

**Tech Stack:** SvelteKit (Svelte 5), Vite, TypeScript, Dexie 4, Vitest, `fake-indexeddb` (tests). CSV parsing is implemented manually in `rosterImport.ts` (first-column rule from spec).

---

## File structure (target)

| Path | Responsibility |
|------|----------------|
| `svelte.config.js` | `@sveltejs/adapter-static` with `fallback: 'index.html'` |
| `vite.config.ts` | Vitest project config + test `include` |
| `src/app.html` | App shell |
| `src/app.d.ts` | SvelteKit ambient types |
| `src/routes/+layout.ts` | `export const ssr = false`, `export const prerender = false` (SPA; no prerender of dynamic routes) |
| `src/routes/+layout.svelte` | App chrome, global **class switcher**, error toast region |
| `src/routes/+page.svelte` | Empty state or navigate to last / first class |
| `src/routes/class/[classId]/+layout.ts` | Validate `classId`; load class or redirect |
| `src/routes/class/[classId]/+layout.svelte` | Subnav: **Schedule** · **Students** |
| `src/routes/class/[classId]/+page.svelte` | Hour target, stats, lesson list, add/edit/delete lessons, duplicate-date hint |
| `src/routes/class/[classId]/students/+page.svelte` | Student CRUD, import preview, append/replace |
| `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte` | Lesson fields + absent toggles (auto-save) |
| `src/lib/db/types.ts` | `ClassRow`, `StudentRow`, `LessonRow`, `AbsenceRow` interfaces |
| `src/lib/db/client.ts` | `Dexie` subclass, `version(1).stores({...})`, exported `db` singleton |
| `src/lib/repos/classes.repo.ts` | Class CRUD; delete cascades students, lessons, absences |
| `src/lib/repos/students.repo.ts` | Student CRUD; delete cascades absence rows for student |
| `src/lib/repos/lessons.repo.ts` | Lesson CRUD; delete cascades absences for lesson |
| `src/lib/repos/attendance.repo.ts` | Get/set absent student ids per lesson |
| `src/lib/logic/stats.ts` | `sumScheduledHours`, `remainingHours`, `lessonCounts` |
| `src/lib/logic/rosterImport.ts` | `parseTxtNames`, `parseCsvNames` + `{ imported, skipped }` |
| `src/lib/preferences/activeClass.ts` | `get` / `set` last class id (`localStorage`) |
| `src/lib/ui/ConfirmDialog.svelte` | Reusable confirm (delete class, replace roster) — optional inline `<dialog>` |
| `src/test/setup.ts` | `import 'fake-indexeddb/auto'` |
| `src/lib/logic/stats.test.ts` | Vitest unit tests |
| `src/lib/logic/rosterImport.test.ts` | Vitest unit tests |
| `src/lib/repos/classes.repo.test.ts` | Integration-style tests against fake IndexedDB |

**Dexie schema (v1)**

- `classes`: primary key `id` (string UUID). Indexes: `name` (optional). Fields: `name`, `totalHoursTarget` (number), `createdAt` (number).
- `students`: primary key `id`. Index `classId`. Fields: `classId`, `name`.
- `lessons`: primary key `id`. Indexes: `classId`, `[classId+date]` composite as `classId`, `date` separate indexes for queries. Fields: `classId`, `date` (`YYYY-MM-DD`), `durationHours`, `title`, `done` (boolean).
- `absences`: primary key `id` string `${lessonId}__${studentId}`. Indexes: `lessonId`, `studentId`. Fields: `lessonId`, `studentId`. Row exists **iff** student was **absent**.

---

### Task 1: Scaffold SvelteKit in repo root (non-empty dir)

**Files:**
- Create: project files under `calendar-planner/` (many)
- Modify: none beyond generated

- [ ] **Step 1: Run Svelte CLI** (directory contains `docs/` — use `--no-dir-check`)

```bash
cd /Users/giovanniabbatepaolo/Desktop/calendar-planner
npx sv create . --template minimal --types ts --add vitest --install npm --no-dir-check
```

Expected: CLI creates `package.json`, `src/`, `vite.config.ts`, `svelte.config.js`, etc., and runs `npm install`.

- [ ] **Step 2: Verify dev server**

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Expected: server starts; open `http://127.0.0.1:5173` — page loads. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold SvelteKit with Vitest"
```

---

### Task 2: Static adapter + SPA fallback + disable SSR

**Files:**
- Modify: `svelte.config.js`
- Modify: `package.json` (dependency)
- Create: `src/routes/+layout.ts`

- [ ] **Step 1: Install adapter-static**

```bash
npm install -D @sveltejs/adapter-static
```

- [ ] **Step 2: Replace `svelte.config.js` contents**

```javascript
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			fallback: 'index.html'
		})
	}
};

export default config;
```

- [ ] **Step 3: Add root layout server flags**

Create `src/routes/+layout.ts`:

```typescript
export const ssr = false;
export const prerender = false;
```

(Use `prerender = false` so dynamic routes are not required at build prerender; static host still serves `index.html` fallback.)

- [ ] **Step 4: Build check**

```bash
npm run build
```

Expected: `build/` contains `index.html` and client bundles; no prerender errors for missing dynamic routes.

- [ ] **Step 5: Commit**

```bash
git add svelte.config.js package.json package-lock.json src/routes/+layout.ts
git commit -m "build: adapter-static SPA fallback and disable SSR"
```

---

### Task 3: Pure stats module + Vitest (TDD)

**Files:**
- Create: `src/lib/logic/stats.ts`
- Create: `src/lib/logic/stats.test.ts`
- Modify: `vite.config.ts` (or `vitest.config.ts` if split) — ensure `test` section includes `environment: 'node'`

- [ ] **Step 1: Write failing tests** — `src/lib/logic/stats.test.ts`

```typescript
import { describe, expect, it } from 'vitest';
import { doneLessonCount, remainingHours, scheduledLessonCount, sumScheduledHours } from './stats';

describe('stats', () => {
	it('sumScheduledHours sums durationHours', () => {
		expect(sumScheduledHours([{ durationHours: 2 }, { durationHours: 1.5 }])).toBe(3.5);
		expect(sumScheduledHours([])).toBe(0);
	});

	it('remainingHours is target minus scheduled', () => {
		expect(remainingHours(10, 3)).toBe(7);
		expect(remainingHours(10, 12)).toBe(-2);
	});

	it('scheduledLessonCount and doneLessonCount', () => {
		const lessons = [
			{ done: true, durationHours: 1 },
			{ done: false, durationHours: 2 },
			{ done: true, durationHours: 0.5 }
		];
		expect(scheduledLessonCount(lessons)).toBe(3);
		expect(doneLessonCount(lessons)).toBe(2);
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/lib/logic/stats.test.ts
```

Expected: FAIL — cannot resolve `./stats` or missing exports.

- [ ] **Step 3: Implement** — `src/lib/logic/stats.ts`

```typescript
export type LessonForStats = {
	durationHours: number;
	done: boolean;
};

export function sumScheduledHours(lessons: Pick<LessonForStats, 'durationHours'>[]): number {
	return lessons.reduce((s, l) => s + l.durationHours, 0);
}

export function remainingHours(totalHoursTarget: number, scheduledHours: number): number {
	return totalHoursTarget - scheduledHours;
}

export function scheduledLessonCount(lessons: unknown[]): number {
	return lessons.length;
}

export function doneLessonCount(lessons: LessonForStats[]): number {
	return lessons.filter((l) => l.done).length;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/lib/logic/stats.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/logic/stats.ts src/lib/logic/stats.test.ts
git commit -m "feat: add pure stats helpers with tests"
```

---

### Task 4: Roster import parsing + tests

**Files:**
- Create: `src/lib/logic/rosterImport.ts`
- Create: `src/lib/logic/rosterImport.test.ts`

- [ ] **Step 1: Write tests** — `src/lib/logic/rosterImport.test.ts`

```typescript
import { describe, expect, it } from 'vitest';
import { parseCsvNames, parseTxtNames } from './rosterImport';

describe('rosterImport', () => {
	it('parseTxtNames trims and drops empties', () => {
		const r = parseTxtNames('  a \n\nb\r\nc');
		expect(r.names).toEqual(['a', 'b', 'c']);
		expect(r.skipped).toBe(0);
	});

	it('parseCsvNames uses first column; header name', () => {
		const r = parseCsvNames('name,note\nAlice,x\nBob,y');
		expect(r.names).toEqual(['Alice', 'Bob']);
		expect(r.skipped).toBe(0);
	});

	it('parseCsvNames without header uses first column', () => {
		const r = parseCsvNames('Zoe,extra\n');
		expect(r.names).toEqual(['Zoe']);
	});

	it('parseCsvNames skips empty first cells', () => {
		const r = parseCsvNames('Alice\n,');
		expect(r.names).toEqual(['Alice']);
		expect(r.skipped).toBe(1);
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/lib/logic/rosterImport.test.ts
```

- [ ] **Step 3: Implement** — `src/lib/logic/rosterImport.ts`

```typescript
export type ImportNamesResult = {
	names: string[];
	skipped: number;
};

export function parseTxtNames(content: string): ImportNamesResult {
	const lines = content.split(/\r?\n/);
	const names: string[] = [];
	let skipped = 0;
	for (const line of lines) {
		const t = line.trim();
		if (!t) continue;
		names.push(t);
	}
	return { names, skipped };
}

function firstCell(line: string): string {
	const comma = line.indexOf(',');
	const cell = comma === -1 ? line : line.slice(0, comma);
	return cell.replace(/^"|"$/g, '').trim();
}

export function parseCsvNames(content: string): ImportNamesResult {
	const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
	if (lines.length === 0) return { names: [], skipped: 0 };

	let start = 0;
	const head = firstCell(lines[0]).toLowerCase();
	if (head === 'name') start = 1;

	const names: string[] = [];
	let skipped = 0;
	for (let i = start; i < lines.length; i++) {
		const cell = firstCell(lines[i]);
		if (cell) names.push(cell);
		else skipped++;
	}
	return { names, skipped };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/lib/logic/rosterImport.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/logic/rosterImport.ts src/lib/logic/rosterImport.test.ts
git commit -m "feat: roster txt/csv name parsing with tests"
```

---

### Task 5: Dexie database client + fake-indexeddb

**Files:**
- Create: `src/lib/db/types.ts`
- Create: `src/lib/db/client.ts`
- Create: `src/test/setup.ts`
- Modify: `vite.config.ts` — `test.setupFiles`

- [ ] **Step 1: Install dependencies**

```bash
npm install dexie
npm install -D fake-indexeddb
```

- [ ] **Step 2: Create `src/lib/db/types.ts`**

```typescript
export type ClassId = string;
export type StudentId = string;
export type LessonId = string;

export type ClassRow = {
	id: ClassId;
	name: string;
	totalHoursTarget: number;
	createdAt: number;
};

export type StudentRow = {
	id: StudentId;
	classId: ClassId;
	name: string;
};

export type LessonRow = {
	id: LessonId;
	classId: ClassId;
	date: string;
	durationHours: number;
	title: string;
	done: boolean;
};

export type AbsenceRow = {
	id: string;
	lessonId: LessonId;
	studentId: StudentId;
};
```

- [ ] **Step 3: Create `src/lib/db/client.ts`**

```typescript
import Dexie, { type Table } from 'dexie';
import type { AbsenceRow, ClassRow, LessonRow, StudentRow } from './types';

export class LessonPlannerDB extends Dexie {
	classes!: Table<ClassRow, string>;
	students!: Table<StudentRow, string>;
	lessons!: Table<LessonRow, string>;
	absences!: Table<AbsenceRow, string>;

	constructor() {
		super('lesson-planner-db');
		this.version(1).stores({
			classes: 'id, name, createdAt',
			students: 'id, classId, name',
			lessons: 'id, classId, date, done',
			absences: 'id, lessonId, studentId'
		});
	}
}

export const db = new LessonPlannerDB();
```

- [ ] **Step 4: Test setup** — `src/test/setup.ts`

```typescript
import 'fake-indexeddb/auto';
```

- [ ] **Step 5: Wire Vitest** — in `vite.config.ts` add inside `defineConfig`:

```typescript
test: {
	include: ['src/**/*.{test,spec}.{js,ts}'],
	environment: 'node',
	setupFiles: ['src/test/setup.ts']
}
```

(Adjust merge if `test` already exists.)

- [ ] **Step 6: Smoke test** — create `src/lib/db/client.smoke.test.ts`

```typescript
import { describe, expect, it } from 'vitest';
import { db } from './client';

describe('db', () => {
	it('opens and writes a class', async () => {
		const id = crypto.randomUUID();
		await db.classes.put({
			id,
			name: 'Test',
			totalHoursTarget: 10,
			createdAt: Date.now()
		});
		const row = await db.classes.get(id);
		expect(row?.name).toBe('Test');
		await db.classes.delete(id);
	});
});
```

```bash
npx vitest run src/lib/db/client.smoke.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/db/types.ts src/lib/db/client.ts src/test/setup.ts vite.config.ts src/lib/db/client.smoke.test.ts
git commit -m "feat: Dexie schema and DB client with smoke test"
```

---

### Task 6: Classes repository + cascade delete + tests

**Files:**
- Create: `src/lib/repos/classes.repo.ts`
- Create: `src/lib/repos/classes.repo.test.ts`

- [ ] **Step 1: Implement** — `src/lib/repos/classes.repo.ts`

```typescript
import { db } from '$lib/db/client';
import type { ClassId, ClassRow } from '$lib/db/types';

export async function listClasses(): Promise<ClassRow[]> {
	return db.classes.orderBy('createdAt').toArray();
}

export async function getClass(id: ClassId): Promise<ClassRow | undefined> {
	return db.classes.get(id);
}

export async function createClass(input: {
	name: string;
	totalHoursTarget: number;
}): Promise<ClassRow> {
	const row: ClassRow = {
		id: crypto.randomUUID(),
		name: input.name,
		totalHoursTarget: input.totalHoursTarget,
		createdAt: Date.now()
	};
	await db.classes.add(row);
	return row;
}

export async function updateClass(
	id: ClassId,
	patch: Partial<Pick<ClassRow, 'name' | 'totalHoursTarget'>>
): Promise<void> {
	await db.classes.update(id, patch);
}

export async function deleteClassCascade(id: ClassId): Promise<void> {
	const studentIds = await db.students.where('classId').equals(id).primaryKeys();
	const lessonIds = await db.lessons.where('classId').equals(id).primaryKeys();

	await db.transaction('rw', db.classes, db.students, db.lessons, db.absences, async () => {
		for (const lessonId of lessonIds) {
			await db.absences.where('lessonId').equals(lessonId).delete();
		}
		for (const studentId of studentIds) {
			await db.absences.where('studentId').equals(studentId).delete();
		}
		await db.lessons.where('classId').equals(id).delete();
		await db.students.where('classId').equals(id).delete();
		await db.classes.delete(id);
	});
}
```

- [ ] **Step 2: Tests** — `src/lib/repos/classes.repo.test.ts`

Reset the database before each test so runs are isolated. `await db.delete()` wipes IndexedDB; `await db.open()` reopens the same exported `db` singleton.

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/db/client';
import { createClass, deleteClassCascade } from './classes.repo';

beforeEach(async () => {
	await db.delete();
	await db.open();
});

describe('classes.repo', () => {
	it('deleteClassCascade removes students lessons absences', async () => {
		const c = await createClass({ name: 'A', totalHoursTarget: 10 });
		const sid = crypto.randomUUID();
		await db.students.add({ id: sid, classId: c.id, name: 'S' });
		const lid = crypto.randomUUID();
		await db.lessons.add({
			id: lid,
			classId: c.id,
			date: '2026-04-01',
			durationHours: 2,
			title: 'L',
			done: false
		});
		await db.absences.add({ id: `${lid}__${sid}`, lessonId: lid, studentId: sid });

		await deleteClassCascade(c.id);

		expect(await db.classes.count()).toBe(0);
		expect(await db.students.count()).toBe(0);
		expect(await db.lessons.count()).toBe(0);
		expect(await db.absences.count()).toBe(0);
	});
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/lib/repos/classes.repo.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/repos/classes.repo.ts src/lib/repos/classes.repo.test.ts
git commit -m "feat: classes repository with cascade delete"
```

---

### Task 7: Students + lessons + attendance repositories

**Files:**
- Create: `src/lib/repos/students.repo.ts`
- Create: `src/lib/repos/lessons.repo.ts`
- Create: `src/lib/repos/attendance.repo.ts`

- [ ] **Step 1: `src/lib/repos/students.repo.ts`**

```typescript
import { db } from '$lib/db/client';
import type { ClassId, StudentId, StudentRow } from '$lib/db/types';

export async function listStudents(classId: ClassId): Promise<StudentRow[]> {
	const rows = await db.students.where('classId').equals(classId).toArray();
	rows.sort((a, b) => a.name.localeCompare(b.name));
	return rows;
}

export async function addStudent(classId: ClassId, name: string): Promise<StudentRow> {
	const row: StudentRow = { id: crypto.randomUUID(), classId, name };
	await db.students.add(row);
	return row;
}

export async function updateStudent(id: StudentId, name: string): Promise<void> {
	await db.students.update(id, { name });
}

export async function deleteStudentCascade(id: StudentId): Promise<void> {
	await db.transaction('rw', db.students, db.absences, async () => {
		await db.absences.where('studentId').equals(id).delete();
		await db.students.delete(id);
	});
}

export async function replaceStudents(classId: ClassId, names: string[]): Promise<void> {
	await db.transaction('rw', db.students, db.absences, async () => {
		const existing = await db.students.where('classId').equals(classId).toArray();
		for (const s of existing) {
			await db.absences.where('studentId').equals(s.id).delete();
		}
		await db.students.where('classId').equals(classId).delete();
		for (const name of names) {
			await db.students.add({ id: crypto.randomUUID(), classId, name });
		}
	});
}

export async function appendStudents(classId: ClassId, names: string[]): Promise<void> {
	for (const name of names) {
		await db.students.add({ id: crypto.randomUUID(), classId, name });
	}
}
```

- [ ] **Step 2: `src/lib/repos/lessons.repo.ts`**

```typescript
import { db } from '$lib/db/client';
import type { ClassId, LessonId, LessonRow } from '$lib/db/types';

export async function listLessons(classId: ClassId): Promise<LessonRow[]> {
	const rows = await db.lessons.where('classId').equals(classId).toArray();
	rows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
	return rows;
}

export async function getLesson(id: LessonId): Promise<LessonRow | undefined> {
	return db.lessons.get(id);
}

export async function createLesson(input: {
	classId: ClassId;
	date: string;
	durationHours: number;
	title: string;
}): Promise<LessonRow> {
	const row: LessonRow = {
		id: crypto.randomUUID(),
		classId: input.classId,
		date: input.date,
		durationHours: input.durationHours,
		title: input.title || 'Lesson',
		done: false
	};
	await db.lessons.add(row);
	return row;
}

export async function updateLesson(
	id: LessonId,
	patch: Partial<Pick<LessonRow, 'date' | 'durationHours' | 'title' | 'done'>>
): Promise<void> {
	await db.lessons.update(id, patch);
}

export async function deleteLessonCascade(id: LessonId): Promise<void> {
	await db.transaction('rw', db.lessons, db.absences, async () => {
		await db.absences.where('lessonId').equals(id).delete();
		await db.lessons.delete(id);
	});
}
```

- [ ] **Step 3: `src/lib/repos/attendance.repo.ts`**

```typescript
import { db } from '$lib/db/client';
import type { LessonId, StudentId } from '$lib/db/types';

function absenceId(lessonId: LessonId, studentId: StudentId): string {
	return `${lessonId}__${studentId}`;
}

export async function listAbsentStudentIds(lessonId: LessonId): Promise<StudentId[]> {
	const rows = await db.absences.where('lessonId').equals(lessonId).toArray();
	return rows.map((r) => r.studentId);
}

export async function setAbsent(lessonId: LessonId, studentId: StudentId, absent: boolean): Promise<void> {
	const id = absenceId(lessonId, studentId);
	if (absent) {
		await db.absences.put({ id, lessonId, studentId });
	} else {
		await db.absences.delete(id);
	}
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/repos/students.repo.ts src/lib/repos/lessons.repo.ts src/lib/repos/attendance.repo.ts
git commit -m "feat: students, lessons, attendance repositories"
```

---

### Task 8: Dexie write retry helper + user-visible error contract

**Files:**
- Create: `src/lib/db/withRetry.ts`
- Create: `src/lib/db/withRetry.test.ts`

- [ ] **Step 1: Implement `withRetry`** — `src/lib/db/withRetry.ts`

```typescript
export async function withRetry<T>(fn: () => Promise<T>, opts?: { retries?: number }): Promise<T> {
	const retries = opts?.retries ?? 1;
	let last: unknown;
	for (let i = 0; i <= retries; i++) {
		try {
			return await fn();
		} catch (e) {
			last = e;
			if (i === retries) break;
		}
	}
	throw last;
}
```

- [ ] **Step 2: Test** — `src/lib/db/withRetry.test.ts`

```typescript
import { describe, expect, it, vi } from 'vitest';
import { withRetry } from './withRetry';

describe('withRetry', () => {
	it('retries once then succeeds', async () => {
		let n = 0;
		const fn = vi.fn(async () => {
			n++;
			if (n === 1) throw new Error('fail');
			return 42;
		});
		await expect(withRetry(fn, { retries: 1 })).resolves.toBe(42);
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('throws after retries exhausted', async () => {
		const fn = vi.fn(async () => {
			throw new Error('x');
		});
		await expect(withRetry(fn, { retries: 1 })).rejects.toThrow('x');
		expect(fn).toHaveBeenCalledTimes(2);
	});
});
```

```bash
npx vitest run src/lib/db/withRetry.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/withRetry.ts src/lib/db/withRetry.test.ts
git commit -m "feat: withRetry for IndexedDB writes"
```

---

### Task 9: Active class preference (`localStorage`)

**Files:**
- Create: `src/lib/preferences/activeClass.ts`

```typescript
const KEY = 'lesson-planner:last-class-id';

export function getLastClassId(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(KEY);
}

export function setLastClassId(id: string): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(KEY, id);
}

export function clearLastClassId(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(KEY);
}
```

- [ ] **Step 1: Commit**

```bash
git add src/lib/preferences/activeClass.ts
git commit -m "feat: last active class id in localStorage"
```

---

### Task 10: Root layout — class switcher + toast region

**Files:**
- Modify: `src/routes/+layout.svelte`
- Modify: `src/routes/+page.svelte`
- Create: `src/lib/stores/toast.ts` (simple writable) or inline state

- [ ] **Step 1: Toast store** — `src/lib/stores/toast.ts`

```typescript
import { writable } from 'svelte/store';

export const toastMessage = writable<string | null>(null);

export function showToast(message: string, ms = 4000) {
	toastMessage.set(message);
	setTimeout(() => toastMessage.set(null), ms);
}
```

- [ ] **Step 2: Root layout** — replace `src/routes/+layout.svelte` with structure: header with `<select>` of classes (load `listClasses` in `onMount`), button “New class”, `slot`; bind toast.

Use `$lib/repos/classes.repo` + `createClass` + navigation to `/class/[id]`.

- [ ] **Step 3: Landing `+page.svelte`** — if zero classes, show “Create your first class” button; else `goto('/class/' + getLastClassId() ?? first.id)`.

(Exact Svelte 5 runes vs stores per project template — match generated style.)

- [ ] **Step 4: Manual test** in browser: create class, see switcher, toast on simulated error (temporarily throw in create).

- [ ] **Step 5: Commit**

```bash
git add src/routes/+layout.svelte src/routes/+page.svelte src/lib/stores/toast.ts
git commit -m "feat: global class switcher and landing navigation"
```

---

### Task 11: Class schedule page (overview)

**Files:**
- Create: `src/routes/class/[classId]/+layout.ts`
- Create: `src/routes/class/[classId]/+layout.svelte`
- Create: `src/routes/class/[classId]/+page.svelte`

- [ ] **Step 1: `+layout.ts`** — load class; `error(404)` if missing.

```typescript
import { error } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { getClass } from '$lib/repos/classes.repo';

export const load: LayoutLoad = async ({ params }) => {
	const c = await getClass(params.classId);
	if (!c) throw error(404, 'Class not found');
	return { class: c };
};
```

- [ ] **Step 2: `+layout.svelte`** — `<nav>` links to `./` and `./students`; `setLastClassId` on mount.

- [ ] **Step 3: `+page.svelte`** — form for `totalHoursTarget` (number input); display `sumScheduledHours`, `remainingHours`, `scheduledLessonCount`, `doneLessonCount` from loaded lessons; table of lessons with Edit/Delete links to modal or inline; “Add lesson” form (`<input type="date">`, hours, title); duplicate-date warning if same `date` appears >1.

- [ ] **Step 4: Wire `withRetry` + `showToast` on failed writes.

- [ ] **Step 5: Commit**

```bash
git add src/routes/class/\[classId\]/
git commit -m "feat: class overview with hours stats and lesson CRUD"
```

---

### Task 12: Students page + import

**Files:**
- Create: `src/routes/class/[classId]/students/+page.svelte`

- [ ] **Step 1:** List students; add name; edit; delete with confirm; import `<input type="file" accept=".txt,.csv">` → `FileReader` → `parseTxtNames` / `parseCsvNames` (detect by extension) → preview table → Append / Replace (replace: `confirm()` then `replaceStudents`).

- [ ] **Step 2:** Show empty-state copy when no students.

- [ ] **Step 3: Commit**

```bash
git add src/routes/class/\[classId\]/students/+page.svelte
git commit -m "feat: students CRUD and roster import"
```

---

### Task 13: Lesson attendance page

**Files:**
- Create: `src/routes/class/[classId]/lesson/[lessonId]/+page.ts`
- Create: `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`

- [ ] **Step 1: `+page.ts`** — load lesson, class, students.

- [ ] **Step 2: `+page.svelte`** — toggles: for each student, checkbox “Absent”; `onchange` → `setAbsent` with `withRetry` + toast on failure. If no students, show spec copy.

- [ ] **Step 3: Commit**

```bash
git add src/routes/class/\[classId\]/lesson/\[lessonId\]/
git commit -m "feat: per-lesson attendance with auto-save"
```

---

### Task 14: Polish — delete class confirm, empty states, a11y

**Files:**
- Modify: `src/routes/+layout.svelte`, class pages as needed

- [ ] **Step 1:** `confirm()` before `deleteClassCascade`; clear `lastClassId` if deleted id matches.

- [ ] **Step 2:** Ensure inputs have `<label>`; interactive elements keyboard-focusable; date input labeled.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "fix: confirmations, empty states, basic a11y"
```

---

### Task 15: README + verify scripts

**Files:**
- Create: `README.md`

```markdown
# Lesson planner (teacher)

Browser-only lesson planner. Data in IndexedDB (Dexie).

## Develop

\`\`\`bash
npm install
npm run dev
\`\`\`

## Test

\`\`\`bash
npm run test
\`\`\`

## Build (static)

\`\`\`bash
npm run build
\`\`\`

Serve `build/` as static files; SPA fallback is `index.html`.
```

- [ ] **Step 1: Run full test suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Spec coverage (self-review)

| Spec area | Task(s) |
|-----------|---------|
| Multi-class, Dexie persistence | 5–7, 10–11 |
| Semester total hours + dated lessons + hours per date | 5–7, 11 |
| Total vs scheduled hours + remaining/over | 3, 11 |
| Done vs scheduled lesson counts | 3, 11 |
| Student CRUD + txt/csv import | 4, 12 |
| Absent-only attendance, auto-save | 7, 13 |
| Cascade deletes (class, student, lesson) | 6–7 |
| Replace roster destructive + confirm | 7, 12 |
| Duplicate dates allowed + hint | 11 |
| Dexie errors visible + retry | 8, 10–11 |
| Empty states | 10–12, 14 |
| `localStorage` last class | 9, 10–11 |
| Static SPA, no server | 2 |
| Unit tests stats + import | 3–4 |
| Optional repo tests | 6 |

**Placeholder scan:** No `TBD` / vague steps; destructive actions use explicit `confirm` or dedicated UI.

**Type consistency:** Repos use `ClassRow`, `LessonRow`, `StudentRow`, `AbsenceRow` from `types.ts`; absence primary key `${lessonId}__${studentId}` matches `attendance.repo` and `classes.repo` cascade deletes.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-20-lesson-planner.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
