<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import { listLessons, createLesson, updateLesson, deleteLessonCascade } from '$lib/repos/lessons.repo';
	import { updateClass } from '$lib/repos/classes.repo';
	import { withRetry } from '$lib/db/withRetry';
	import { showToast } from '$lib/stores/toast';
	import {
		doneEditableForKind,
		hoursEditableForKind,
		labelForKind,
		labelForTitleField,
		normalizedHoursForKind
	} from '$lib/logic/sessionKindUi';
	import {
		sumScheduledTeacherHours,
		remainingHours,
		doneLessonCount,
		scheduledLessonCount,
		sumTeacherHoursForKind,
		unplannedClassTeacherHours,
		maxExtraTeacherHours,
		remainingFlexTeacherHours,
		totalUnscheduledContractTeacherHours,
		studentHoursFromTeacherHours,
		doneExtraSessionCount,
		scheduledExtraSessionCount
	} from '$lib/logic/stats';
	import type { LessonRow, LessonSessionKind } from '$lib/db/types';

	let { data }: { data: PageData } = $props();

	let lessons = $state<LessonRow[]>([]);

	let newDate = $state('');
	let newHours = $state(2);
	let newTitle = $state('Lesson');
	let newSessionKind = $state<LessonSessionKind>('class');

	// svelte-ignore state_referenced_locally
	const initialTargetHours = data.class.totalHoursTarget;
	// svelte-ignore state_referenced_locally
	const initialTargetStudentLessonHours = data.class.requiredStudentLessonHours;

	let targetHours = $state(initialTargetHours);
	let targetStudentLessonHours = $state(initialTargetStudentLessonHours);

	const scheduled = $derived(sumScheduledTeacherHours(lessons));
	const tClass = $derived(sumTeacherHoursForKind(lessons, 'class'));
	const tExtra = $derived(sumTeacherHoursForKind(lessons, 'extra'));

	const unplannedClassTh = $derived(unplannedClassTeacherHours(targetStudentLessonHours, tClass));
	const maxExtraTh = $derived(maxExtraTeacherHours(targetHours, targetStudentLessonHours));
	const remainingFlexTh = $derived(
		remainingFlexTeacherHours(targetHours, targetStudentLessonHours, tClass, tExtra)
	);
	const totalUnschedTh = $derived(
		totalUnscheduledContractTeacherHours(targetHours, tClass, tExtra)
	);

	const studentHClass = $derived(studentHoursFromTeacherHours(tClass));
	const studentHExtra = $derived(studentHoursFromTeacherHours(tExtra));

	const remaining = $derived(remainingHours(targetHours, scheduled));

	const dupDates = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const l of lessons) {
			counts[l.date] = (counts[l.date] ?? 0) + 1;
		}
		return Object.values(counts).some((n) => n > 1);
	});
	const pctDone = $derived.by(() => {
		const s = scheduledLessonCount(lessons);
		if (s === 0) return 0;
		return Math.round((doneLessonCount(lessons) / s) * 100);
	});

	async function refresh() {
		lessons = await listLessons(data.class.id);
	}

	onMount(refresh);

	async function saveTargets() {
		const t = Number(targetHours);
		const m = Number(targetStudentLessonHours);
		if (!Number.isFinite(t) || t < 0) {
			showToast('Enter a valid non-negative contract (teacher) hour target.');
			return;
		}
		if (!Number.isFinite(m) || m < 0) {
			showToast('Enter a valid non-negative student lesson hours target.');
			return;
		}
		try {
			await withRetry(() =>
				updateClass(data.class.id, {
					totalHoursTarget: t,
					requiredStudentLessonHours: m
				})
			);
			showToast('Saved targets.');
		} catch {
			showToast('Could not save targets.');
		}
	}

	async function addLesson() {
		if (!newDate) {
			showToast('Pick a date for the new lesson.');
			return;
		}
		const h = normalizedHoursForKind(newSessionKind, Number(newHours));
		if (!Number.isFinite(h) || h < 0) {
			showToast('Enter a valid non-negative number of hours.');
			return;
		}
		try {
			await withRetry(() =>
				createLesson({
					classId: data.class.id,
					date: newDate,
					durationHours: h,
					title: newTitle,
					sessionKind: newSessionKind
				})
			);
			newDate = '';
			newHours = 2;
			newTitle = 'Lesson';
			newSessionKind = 'class';
			await refresh();
		} catch {
			showToast('Could not add lesson.');
		}
	}

	function handleNewSessionKindChange(event: Event) {
		const prevKind = newSessionKind;
		const nextKind = (event.currentTarget as HTMLSelectElement).value as LessonSessionKind;
		newSessionKind = nextKind;
		if (nextKind === 'skipped') {
			newHours = 0;
			if (newTitle === 'Lesson') {
				newTitle = '';
			}
		} else if (prevKind === 'skipped' && newHours === 0) {
			newHours = 2;
		}
	}

	async function toggleDone(lesson: LessonRow, done: boolean) {
		try {
			await withRetry(() => updateLesson(lesson.id, { done }));
			await refresh();
		} catch {
			showToast('Could not update lesson.');
		}
	}

	async function removeLesson(id: string) {
		if (!window.confirm('Delete this lesson and its attendance?')) return;
		try {
			await withRetry(() => deleteLessonCascade(id));
			await refresh();
		} catch {
			showToast('Could not delete lesson.');
		}
	}
</script>

<section class="card">
	<h1>{data.class.name}</h1>

	<div class="grid">
		<label>
			Contract hours (N, teacher / 60 min)
			<input type="number" min="0" step="0.5" bind:value={targetHours} />
		</label>
		<label>
			Student lesson hours (M, 50 min units)
			<input type="number" min="0" step="0.5" bind:value={targetStudentLessonHours} />
		</label>
		<button type="button" class="btn" onclick={saveTargets}>Save targets</button>
	</div>

	<div class="stats">
		<p class="hero"><strong>Unplanned class (teacher h):</strong> {unplannedClassTh.toFixed(2)}</p>
		<p class="hero">
			<strong>Max extra pool (teacher h):</strong>
			{maxExtraTh.toFixed(2)}
			{#if maxExtraTh < 0}
				<span class="warn">Contract N is below the minimum teacher hours needed for M — raise N or lower M.</span>
			{/if}
		</p>
		<p class="hero"><strong>Remaining flex (teacher h):</strong> {remainingFlexTh.toFixed(2)}</p>
		<p class="hero"><strong>Unscheduled on contract (teacher h):</strong> {totalUnschedTh.toFixed(2)}</p>

		<p><strong>Scheduled (all sessions, teacher h):</strong> {scheduled.toFixed(2)}</p>
		<p>
			<strong>{remaining >= 0 ? 'Remaining vs contract' : 'Over contract by'}:</strong>
			{Math.abs(remaining).toFixed(2)} h
		</p>
		<p>
			<strong>Class teacher h / Extra teacher h:</strong>
			{tClass.toFixed(2)} / {tExtra.toFixed(2)}
		</p>
		<p>
			<strong>Student h (derived) — class / extra:</strong>
			{studentHClass.toFixed(2)} / {studentHExtra.toFixed(2)}
		</p>
		<p>
			<strong>Class lessons done:</strong>
			{doneLessonCount(lessons)} / {scheduledLessonCount(lessons)} ({pctDone}%)
		</p>
		<p>
			<strong>Extra sessions done:</strong>
			{doneExtraSessionCount(lessons)} / {scheduledExtraSessionCount(lessons)}
		</p>
	</div>

	{#if dupDates}
		<p class="hint">Some dates have more than one lesson — allowed.</p>
	{/if}
</section>

<section class="card">
	<h2>Add session</h2>
	<div class="grid add">
		<label>
			Date
			<input type="date" bind:value={newDate} />
		</label>
		<label>
			Hours (teacher)
			<input
				type="number"
				min="0"
				step="0.25"
				bind:value={newHours}
				disabled={!hoursEditableForKind(newSessionKind)}
				title={hoursEditableForKind(newSessionKind)
					? undefined
					: 'Skipped sessions always use 0 teacher hours.'}
			/>
		</label>
		<label>
			{labelForTitleField(newSessionKind)}
			<input type="text" bind:value={newTitle} />
		</label>
		<label>
			Kind
			<select value={newSessionKind} onchange={handleNewSessionKindChange}>
				<option value="class">Class</option>
				<option value="extra">Extra / 1:1</option>
				<option value="skipped">Skipped</option>
			</select>
		</label>
		<button type="button" class="btn primary" onclick={addLesson}>Add</button>
	</div>
</section>

<section class="card">
	<h2>Sessions</h2>
	{#if lessons.length === 0}
		<p class="muted">No sessions yet. Add one above.</p>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>Kind</th>
						<th>Date</th>
						<th>Hours</th>
						<th>Title</th>
						<th>Done</th>
						<th scope="col" class="sr-only">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each lessons as lesson (lesson.id)}
						<tr>
							<td>
								<span
									class="badge"
									class:badge-class={lesson.sessionKind === 'class'}
									class:badge-extra={lesson.sessionKind === 'extra'}
									class:badge-skipped={lesson.sessionKind === 'skipped'}
								>
									{labelForKind(lesson.sessionKind)}
								</span>
							</td>
							<td>{lesson.date}</td>
							<td>{lesson.durationHours}</td>
							<td>{lesson.title}</td>
							<td>
								<input
									type="checkbox"
									checked={lesson.done}
									disabled={!doneEditableForKind(lesson.sessionKind)}
									title={doneEditableForKind(lesson.sessionKind)
										? undefined
										: 'Skipped sessions cannot be marked done.'}
									onchange={(e) => toggleDone(lesson, (e.currentTarget as HTMLInputElement).checked)}
								/>
							</td>
							<td class="actions">
								<a
									class="link"
									href={resolve('/class/[classId]/lesson/[lessonId]', {
										classId: data.class.id,
										lessonId: lesson.id
									})}
								>
									Open
								</a>
								<button type="button" class="link danger" onclick={() => removeLesson(lesson.id)}>
									Delete
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<style>
	.card {
		background: #fff;
		padding: 1.25rem;
		border-radius: 8px;
		border: 1px solid #e2e5eb;
		margin-bottom: 1rem;
	}
	h1 {
		margin: 0 0 1rem;
		font-size: 1.35rem;
	}
	h2 {
		margin: 0 0 0.75rem;
		font-size: 1.1rem;
	}
	.grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: flex-end;
	}
	.grid.add label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
	}
	input[type='number'],
	input[type='date'],
	input[type='text'],
	select {
		padding: 0.35rem 0.5rem;
		border: 1px solid #c9ced6;
		border-radius: 6px;
	}
	.stats p {
		margin: 0.25rem 0;
	}
	.stats .hero {
		font-size: 1rem;
	}
	.warn {
		display: block;
		color: #8a4b00;
		font-size: 0.85rem;
		font-weight: normal;
		margin-top: 0.25rem;
	}
	.badge {
		display: inline-block;
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.badge-class {
		background: #e8f0fe;
		color: #174ea6;
	}
	.badge-extra {
		background: #f3e8fd;
		color: #6a1b9a;
	}
	.badge-skipped {
		background: #f1f3f4;
		color: #3c4043;
	}
	.btn {
		padding: 0.4rem 0.75rem;
		border: 1px solid #c9ced6;
		background: #fff;
		border-radius: 6px;
		cursor: pointer;
		align-self: center;
	}
	.btn.primary {
		background: #1a56b8;
		color: #fff;
		border-color: #1a56b8;
	}
	.hint {
		color: #6a5b00;
		font-size: 0.9rem;
	}
	.muted {
		color: #666;
	}
	.table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.95rem;
	}
	th,
	td {
		padding: 0.5rem 0.4rem;
		border-bottom: 1px solid #e9ecf1;
		text-align: left;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.link {
		background: none;
		border: none;
		padding: 0;
		color: #1a56b8;
		cursor: pointer;
		text-decoration: underline;
		font: inherit;
	}
	.link.danger {
		color: #a32020;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
