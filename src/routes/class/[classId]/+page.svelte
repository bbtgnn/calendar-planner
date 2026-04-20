<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import { listLessons, createLesson, updateLesson, deleteLessonCascade } from '$lib/repos/lessons.repo';
	import { updateClass } from '$lib/repos/classes.repo';
	import { withRetry } from '$lib/db/withRetry';
	import { showToast } from '$lib/stores/toast';
	import {
		sumScheduledHours,
		remainingHours,
		doneLessonCount,
		scheduledLessonCount
	} from '$lib/logic/stats';
	import type { LessonRow } from '$lib/db/types';

	let { data }: { data: PageData } = $props();

	let lessons = $state<LessonRow[]>([]);

	let newDate = $state('');
	let newHours = $state(2);
	let newTitle = $state('Lesson');

	let targetHours = $state(0);

	$effect(() => {
		targetHours = data.class.totalHoursTarget;
	});

	const scheduled = $derived(sumScheduledHours(lessons));
	const remaining = $derived(remainingHours(targetHours, scheduled));
	const dupDates = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const l of lessons) {
			counts.set(l.date, (counts.get(l.date) ?? 0) + 1);
		}
		return [...counts.values()].some((n) => n > 1);
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

	async function saveTarget() {
		try {
			await withRetry(() => updateClass(data.class.id, { totalHoursTarget: targetHours }));
			showToast('Saved hour target.');
		} catch {
			showToast('Could not save hour target.');
		}
	}

	async function addLesson() {
		if (!newDate) {
			showToast('Pick a date for the new lesson.');
			return;
		}
		const h = Number(newHours);
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
					title: newTitle
				})
			);
			newDate = '';
			newHours = 2;
			newTitle = 'Lesson';
			await refresh();
		} catch {
			showToast('Could not add lesson.');
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
			Semester hour target
			<input type="number" min="0" step="0.5" bind:value={targetHours} />
		</label>
		<button type="button" class="btn" onclick={saveTarget}>Save target</button>
	</div>

	<div class="stats">
		<p><strong>Scheduled hours:</strong> {scheduled.toFixed(2)}</p>
		<p>
			<strong>{remaining >= 0 ? 'Remaining' : 'Over by'}:</strong>
			{Math.abs(remaining).toFixed(2)} h
		</p>
		<p>
			<strong>Lessons done:</strong>
			{doneLessonCount(lessons)} / {scheduledLessonCount(lessons)} ({pctDone}%)
		</p>
	</div>

	{#if dupDates}
		<p class="hint">Some dates have more than one lesson — allowed.</p>
	{/if}
</section>

<section class="card">
	<h2>Add lesson</h2>
	<div class="grid add">
		<label>
			Date
			<input type="date" bind:value={newDate} />
		</label>
		<label>
			Hours
			<input type="number" min="0" step="0.25" bind:value={newHours} />
		</label>
		<label>
			Title
			<input type="text" bind:value={newTitle} />
		</label>
		<button type="button" class="btn primary" onclick={addLesson}>Add</button>
	</div>
</section>

<section class="card">
	<h2>Lessons</h2>
	{#if lessons.length === 0}
		<p class="muted">No lessons yet. Add one above.</p>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
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
							<td>{lesson.date}</td>
							<td>{lesson.durationHours}</td>
							<td>{lesson.title}</td>
							<td>
								<input
									type="checkbox"
									checked={lesson.done}
									onchange={(e) => toggleDone(lesson, (e.currentTarget as HTMLInputElement).checked)}
								/>
							</td>
							<td class="actions">
								<a class="link" href="/class/{data.class.id}/lesson/{lesson.id}">Open</a>
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
	input[type='text'] {
		padding: 0.35rem 0.5rem;
		border: 1px solid #c9ced6;
		border-radius: 6px;
	}
	.stats p {
		margin: 0.25rem 0;
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
