<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { db } from '$lib/db/client';
	import type {
		AbsenceRow,
		ClassRow,
		LessonRow,
		LessonSessionKind,
		StudentRow
	} from '$lib/db/types';
	import { clearLastClassId } from '$lib/preferences/activeClass';
	import { showToast } from '$lib/ui/toast.svelte';

	type ParsedBackup = {
		classes: ClassRow[];
		students: StudentRow[];
		lessons: LessonRow[];
		absences: AbsenceRow[];
	};

	type BackupSummary = {
		classCount: number;
		lessonCount: number;
		studentCount: number;
		absenceCount: number;
	};

	const SESSION_KINDS = new Set<LessonSessionKind>(['class', 'extra', 'skipped']);

	let fileInput: HTMLInputElement | undefined = $state();
	let error = $state<string | null>(null);
	let summary = $state<BackupSummary | null>(null);
	let parsed = $state<ParsedBackup | null>(null);
	let restoring = $state(false);

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

	function parseBackup(json: unknown): ParsedBackup | string {
		if (!isRecord(json)) {
			return 'Not a valid backup file — expected classes, students, lessons, and absences.';
		}
		for (const key of ['classes', 'students', 'lessons', 'absences'] as const) {
			if (!Array.isArray(json[key])) {
				return 'Not a valid backup file — expected classes, students, lessons, and absences.';
			}
		}

		const classes: ClassRow[] = [];
		for (const raw of json.classes as unknown[]) {
			const row = parseClassRow(raw);
			if (!row) return 'Not a valid backup file — expected classes, students, lessons, and absences.';
			classes.push(row);
		}

		const classIds = new Set(classes.map((c) => c.id));

		const students: StudentRow[] = [];
		for (const raw of json.students as unknown[]) {
			const row = parseStudentRow(raw);
			if (!row) return 'Not a valid backup file — expected classes, students, lessons, and absences.';
			if (!classIds.has(row.classId)) {
				return 'Backup has invalid references — restore cancelled.';
			}
			students.push(row);
		}

		const studentIds = new Set(students.map((s) => s.id));

		const lessons: LessonRow[] = [];
		for (const raw of json.lessons as unknown[]) {
			const row = parseLessonRow(raw);
			if (!row) return 'Not a valid backup file — expected classes, students, lessons, and absences.';
			if (!classIds.has(row.classId)) {
				return 'Backup has invalid references — restore cancelled.';
			}
			lessons.push(row);
		}

		const lessonIds = new Set(lessons.map((l) => l.id));

		const absences: AbsenceRow[] = [];
		for (const raw of json.absences as unknown[]) {
			const row = parseAbsenceRow(raw);
			if (!row) return 'Not a valid backup file — expected classes, students, lessons, and absences.';
			if (!lessonIds.has(row.lessonId) || !studentIds.has(row.studentId)) {
				return 'Backup has invalid references — restore cancelled.';
			}
			absences.push(row);
		}

		return { classes, students, lessons, absences };
	}

	function resetState() {
		error = null;
		summary = null;
		parsed = null;
	}

	async function onFileChange(e: Event) {
		resetState();
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		let text: string;
		try {
			text = await file.text();
		} catch {
			error = 'Could not read file.';
			return;
		}

		let json: unknown;
		try {
			json = JSON.parse(text);
		} catch {
			error = 'Could not read file — not valid JSON.';
			return;
		}

		const result = parseBackup(json);
		if (typeof result === 'string') {
			error = result;
			return;
		}

		parsed = result;
		summary = {
			classCount: result.classes.length,
			lessonCount: result.lessons.length,
			studentCount: result.students.length,
			absenceCount: result.absences.length
		};
	}

	function onChooseFile() {
		fileInput?.click();
	}

	async function onRestore() {
		if (!parsed || restoring) return;
		if (!window.confirm('Replace all data with this backup? This cannot be undone.')) return;

		restoring = true;
		error = null;
		const data = parsed;

		try {
			await db.transaction('rw', db.classes, db.students, db.lessons, db.absences, async () => {
				await db.absences.clear();
				await db.students.clear();
				await db.lessons.clear();
				await db.classes.clear();
				if (data.classes.length) await db.classes.bulkAdd(data.classes);
				if (data.students.length) await db.students.bulkAdd(data.students);
				if (data.lessons.length) await db.lessons.bulkAdd(data.lessons);
				if (data.absences.length) await db.absences.bulkAdd(data.absences);
			});
		} catch {
			error = 'Restore failed — your existing data was not changed.';
			restoring = false;
			return;
		}

		try {
			clearLastClassId();
			await invalidateAll();
			showToast('Backup restored');
			await goto('/');
		} catch {
			error = 'Backup was restored but navigation failed. Refresh the page.';
		} finally {
			restoring = false;
		}
	}
</script>

<div class="panel">
	<h1>Restore legacy backup</h1>
	<p class="warn">
		This replaces <strong>all</strong> data in this browser. It cannot be undone.
	</p>

	<input
		bind:this={fileInput}
		type="file"
		accept=".json,application/json"
		class="sr"
		onchange={onFileChange}
	/>

	<div class="actions">
		<button type="button" class="btn" onclick={onChooseFile}>Choose backup file</button>
		<button type="button" class="btn primary" disabled={!parsed || restoring} onclick={onRestore}>
			{restoring ? 'Restoring…' : 'Restore'}
		</button>
	</div>

	{#if summary}
		<p class="summary">
			{summary.classCount} classes, {summary.lessonCount} lessons, {summary.studentCount} students,
			{summary.absenceCount} absences
		</p>
	{/if}

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}
</div>

<style>
	.panel { max-width: 36rem; margin: 2rem auto; padding: 1.5rem; background: #fff; border: 1px solid #e2e5eb; border-radius: 8px; }
	h1 { margin: 0 0 0.75rem; font-size: 1.25rem; }
	.warn { margin: 0 0 1rem; color: #5c6370; }
	.actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
	.btn { padding: 0.4rem 0.75rem; border: 1px solid #c8ced8; border-radius: 6px; background: #fff; cursor: pointer; font: inherit; }
	.btn.primary { background: #1a56db; border-color: #1a56db; color: #fff; }
	.btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.summary { margin: 0; color: #1a1a1a; }
	.error { margin: 0.75rem 0 0; color: #b42318; }
	.sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
</style>
