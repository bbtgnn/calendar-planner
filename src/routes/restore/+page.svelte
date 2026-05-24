<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { db } from '$lib/db/client';
	import type {
		AbsenceRow,
		ClassRow,
		LessonRow,
		StudentRow
	} from '$lib/db/types';
	import { parseLegacyBackup } from '$lib/persistence/plannerFile';
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

	let fileInput: HTMLInputElement | undefined = $state();
	let error = $state<string | null>(null);
	let summary = $state<BackupSummary | null>(null);
	let parsed = $state<ParsedBackup | null>(null);
	let restoring = $state(false);

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

		const result = parseLegacyBackup(json);
		if (!result.ok) {
			error = result.message;
			return;
		}

		parsed = result.value;
		summary = {
			classCount: result.value.classes.length,
			lessonCount: result.value.lessons.length,
			studentCount: result.value.students.length,
			absenceCount: result.value.absences.length
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
