<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import { classLessonsLoadKey, classMetaLoadKey } from '$lib/kit/loadKeys';
	import { invalidateClassMeta, invalidateLoadKeys, runMutation } from '$lib/kit/runMutation';
	import { createLesson, updateLesson, deleteLessonCascade } from '$lib/application/lessons';
	import { updateClass } from '$lib/application/classes';
	import { showToast } from '$lib/ui/toast.svelte';
	import {
		applyKindToForm,
		lessonFormUi,
		syncAddFormToKind
	} from '$lib/logic/sessionKind';
	import { buildTeacherHourStatBoxes } from '$lib/logic/stats';
	import type { ClassRow, LessonId, LessonSessionKind } from '$lib/db/types';
	import { doneColumnTooltip } from '$lib/lessonNotes/doneTooltip';
	import {
		loadScreenshotObjectUrl,
		revokeScreenshotObjectUrl
	} from '$lib/lessonNotes/loadScreenshot';
	import type { ScreenshotRef } from '$lib/lessonNotes/types';
	import { formatIsoDate } from '$lib/logic/dateFormat';
	import SemesterMap from './SemesterMap.svelte';

	const COLS = 6;
	let expanded = $state<Set<LessonId>>(new Set());
	let imageByLesson = $state<Record<string, { url?: string; error?: string; loading?: boolean }>>(
		{}
	);

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	const initialClass = data.class;
	let classSnapshot = $state<ClassRow>(initialClass);

	$effect(() => {
		classSnapshot = data.class;
	});

	let newDate = $state('');
	let newHours = $state(2);
	let newTitle = $state('Lesson');
	let newSessionKind = $state<LessonSessionKind>('class');

	const newKindUi = $derived(lessonFormUi(newSessionKind));

	$effect(() => {
		const synced = syncAddFormToKind(newSessionKind, { hours: newHours, title: newTitle });
		if (synced.hours !== newHours) newHours = synced.hours;
	});

	// svelte-ignore state_referenced_locally
	const initialTargetHours = data.class.totalHoursTarget;
	// svelte-ignore state_referenced_locally
	const initialTargetStudentLessonHours = data.class.requiredStudentLessonHours;

	let targetHours = $state(initialTargetHours);
	let targetStudentLessonHours = $state(initialTargetStudentLessonHours);

	let lastTargetsClassId = $state<string | null>(null);
	$effect(() => {
		const id = data.class.id;
		if (lastTargetsClassId === id) return;
		lastTargetsClassId = id;
		targetHours = data.class.totalHoursTarget;
		targetStudentLessonHours = data.class.requiredStudentLessonHours;
	});

	const statBoxes = $derived(
		buildTeacherHourStatBoxes(Number(targetHours), Number(targetStudentLessonHours), data.lessons)
	);

	const dupDates = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const l of data.lessons) {
			counts[l.date] = (counts[l.date] ?? 0) + 1;
		}
		return Object.values(counts).some((n) => n > 1);
	});

	const classMetaKey = $derived(classMetaLoadKey(data.class.id));
	const classLessonsKey = $derived(classLessonsLoadKey(data.class.id));

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
		await runMutation({
			fn: () =>
				updateClass(data.class.id, {
					totalHoursTarget: t,
					requiredStudentLessonHours: m
				}),
			invalidate: classMetaKey,
			successToast: 'Saved targets.',
			errorToast: 'Could not save targets.'
		});
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
		await runMutation({
			fn: () =>
				createLesson({
					classId: data.class.id,
					date: newDate,
					durationHours: h,
					title: newTitle,
					sessionKind: newSessionKind
				}),
			invalidate: classLessonsKey,
			errorToast: 'Could not add lesson.',
			onSuccess: () => {
				newDate = '';
				newHours = 2;
				newTitle = 'Lesson';
				newSessionKind = 'class';
			}
		});
	}

	function handleNewSessionKindChange(event: Event) {
		const prevKind = newSessionKind;
		const nextKind = (event.currentTarget as HTMLSelectElement).value as LessonSessionKind;
		newSessionKind = nextKind;
		const next = applyKindToForm(prevKind, nextKind, { hours: newHours, title: newTitle });
		newHours = next.hours;
		newTitle = next.title;
	}

	async function refreshNotesFromFolder() {
		await invalidateLoadKeys(classLessonsKey);
	}

	async function removeLesson(id: string) {
		if (!window.confirm('Delete this lesson and its attendance?')) return;
		await runMutation({
			fn: () => deleteLessonCascade(id),
			invalidate: classLessonsKey,
			errorToast: 'Could not delete lesson.'
		});
	}

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
			void ensureScreenshotLoaded(lesson.id, lesson.screenshotRef);
		}
		expanded = next;
	}

	async function ensureScreenshotLoaded(lessonId: LessonId, ref: ScreenshotRef) {
		if (imageByLesson[lessonId]?.url || imageByLesson[lessonId]?.loading) return;
		imageByLesson = { ...imageByLesson, [lessonId]: { loading: true } };
		const result = await loadScreenshotObjectUrl(data.class.id, ref);
		imageByLesson = {
			...imageByLesson,
			[lessonId]: result.ok ? { url: result.url } : { error: result.message }
		};
	}

	$effect(() => {
		return () => {
			for (const entry of Object.values(imageByLesson)) {
				revokeScreenshotObjectUrl(entry?.url);
			}
		};
	});
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

	<div class="stats-summary" aria-label="Teacher hour overview">
		{#each statBoxes as box (box.key)}
			<div class="stat-box">
				<span class="stat-box__title">{box.title}</span>
				<p class="size-8" aria-label="{box.title} planned vs total">{box.fractionLabel}</p>
				<p
					class="size-4"
					class:tier-done={box.tier === 'done'}
					class:tier-almost={box.tier === 'almost'}
					class:tier-behind={box.tier === 'behind'}
					aria-label="{box.title} fill percent"
				>
					{box.percentLabel}
				</p>
				{#if box.warning}
					<p class="warn size-4">{box.warning}</p>
				{/if}
			</div>
		{/each}
	</div>

	{#if dupDates}
		<p class="hint">Some dates have more than one lesson — allowed.</p>
	{/if}

	{#if data.notesScanned}
		<section class="notes-panel" aria-label="Lesson notes">
			<div class="notes-panel__head">
				<h2 class="notes-panel__title">Lesson notes</h2>
				<button type="button" class="btn" onclick={() => void refreshNotesFromFolder()}>
					Refresh from folder
				</button>
			</div>
			{#if data.noteWarnings.length > 0}
				<ul class="notes-warnings">
					{#each data.noteWarnings as w (w.message)}
						<li>{w.message}</li>
					{/each}
				</ul>
			{:else}
				<p class="muted notes-panel__ok">No warnings from lezioni/ or extra/ notes.</p>
			{/if}
		</section>
	{/if}
</section>

<SemesterMap
	classRow={classSnapshot}
	lessons={data.lessons}
	noteWarnings={data.noteWarnings}
	onSemesterSaved={async (c) => {
		classSnapshot = c;
		await invalidateClassMeta(data.class.id);
	}}
/>

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
				disabled={!newKindUi.hoursEditable}
				title={newKindUi.hoursDisabledTitle}
			/>
		</label>
		<label>
			{newKindUi.titleLabel}
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
	{#if data.lessons.length === 0}
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
					{#each data.lessons as lesson (lesson.id)}
						{@const isExpandable = !!lesson.screenshotRef}
						<tr
							class:upcoming={data.upcomingDate !== null && lesson.date === data.upcomingDate}
							class:row-expandable={isExpandable}
							class:row-expanded={expanded.has(lesson.id)}
							aria-expanded={isExpandable ? expanded.has(lesson.id) : undefined}
							aria-label={data.upcomingDate !== null && lesson.date === data.upcomingDate
								? 'Upcoming session'
								: undefined}
							onclick={() => isExpandable && toggleExpand(lesson)}
						>
							<td>
								<span
									class="badge"
									class:badge-class={lesson.sessionKind === 'class'}
									class:badge-extra={lesson.sessionKind === 'extra'}
									class:badge-skipped={lesson.sessionKind === 'skipped'}
								>
									{lessonFormUi(lesson.sessionKind).kindLabel}
								</span>
							</td>
							<td>{formatIsoDate(lesson.date)}</td>
							<td>{lesson.durationHours}</td>
							<td>{lesson.title}</td>
							<td class="done-cell">
								{#if lesson.sessionKind === 'skipped'}
									<span class="muted">—</span>
								{:else if lesson.done}
									<span class="done-yes" title="Note and screenshot on disk">✓</span>
									{#if lesson.hoursWarning}
										<span
											class="warn-icon"
											title="Hours: planner {lesson.hoursWarning.plannerHours}h, note {lesson
												.hoursWarning.noteHours}h"
											>⚠</span
										>
									{/if}
								{:else}
									<span class="muted">—</span>
									{#if lesson.screenshotMissing}
										<span class="warn-icon" title={doneColumnTooltip(lesson)}>⚠</span>
									{/if}
								{/if}
							</td>
							<td class="actions" onclick={(e) => e.stopPropagation()}>
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
						{#if expanded.has(lesson.id)}
							<tr class="screenshot-detail">
								<td colspan={COLS}>
									{#if imageByLesson[lesson.id]?.loading}
										<p class="muted">Loading…</p>
									{:else if imageByLesson[lesson.id]?.error}
										<p class="warn">{imageByLesson[lesson.id].error}</p>
									{:else if imageByLesson[lesson.id]?.url}
										<img
											src={imageByLesson[lesson.id].url}
											alt="Screenshot for {lesson.title}"
										/>
									{/if}
								</td>
							</tr>
						{/if}
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
	.stats-summary {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
		margin-top: 0.5rem;
	}
	.stat-box {
		padding: 1rem 1.15rem;
		border: 1px solid #e2e5eb;
		border-radius: 8px;
		background: #f8fafc;
		min-width: 0;
	}
	.stat-box__title {
		display: block;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #64748b;
		margin-bottom: 0.35rem;
	}
	.size-8 {
		margin: 0;
		font-size: 2rem;
		font-weight: 700;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}
	.size-4 {
		margin: 0.35rem 0 0;
		font-size: 0.875rem;
		line-height: 1.35;
		color: #64748b;
	}
	.tier-done {
		color: #16a34a;
	}
	.tier-almost {
		color: #65a30d;
	}
	.tier-behind {
		color: #9ca3af;
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
		background: #dcfce7;
		color: #16a34a;
		border: 1px solid #16a34a;
	}
	.badge-extra {
		background: #dbeafe;
		color: #2563eb;
		border: 1px solid #2563eb;
	}
	.badge-skipped {
		background: #fee2e2;
		color: #dc2626;
		border: 1px solid #dc2626;
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
	.notes-panel {
		margin-top: 1rem;
		padding-top: 0.75rem;
		border-top: 1px solid #e2e5eb;
	}
	.notes-panel__head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.notes-panel__title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}
	.notes-panel__ok {
		margin: 0;
		font-size: 0.85rem;
	}
	.notes-warnings {
		margin: 0;
		padding-left: 1.25rem;
		font-size: 0.85rem;
		color: #8a4b00;
	}
	.done-cell {
		white-space: nowrap;
	}
	.done-yes {
		color: #16a34a;
		font-weight: 700;
	}
	.warn-icon {
		margin-left: 0.25rem;
	}
	tr.row-expandable {
		cursor: pointer;
	}
	tr.row-expandable:hover {
		background: #f6f8fb;
	}
	tr.upcoming {
		background: #f0f7ff;
		box-shadow: inset 3px 0 0 #1967d2;
	}
	.screenshot-detail img {
		max-width: 100%;
		max-height: 70vh;
		display: block;
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
	@media (max-width: 640px) {
		.stats-summary {
			grid-template-columns: 1fr;
		}
	}
</style>
