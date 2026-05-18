<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import { classLessonsLoadKey, classMetaLoadKey } from '$lib/kit/loadKeys';
	import { invalidateClassMeta, runMutation } from '$lib/kit/runMutation';
	import { createLesson, updateLesson, deleteLessonCascade } from '$lib/repos/lessons.repo';
	import { updateClass } from '$lib/repos/classes.repo';
	import { showToast } from '$lib/stores/toast';
	import {
		applyKindToForm,
		lessonFormUi,
		syncAddFormToKind
	} from '$lib/logic/sessionKind';
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
		contractScheduledFillPercent,
		doneExtraSessionCount,
		scheduledExtraSessionCount
	} from '$lib/logic/stats';
	import type { ClassRow, LessonRow, LessonSessionKind } from '$lib/db/types';
	import { formatIsoDate } from '$lib/logic/dateFormat';
	import SemesterMap from './SemesterMap.svelte';

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

	const scheduled = $derived(sumScheduledTeacherHours(data.lessons));
	const tClass = $derived(sumTeacherHoursForKind(data.lessons, 'class'));
	const tExtra = $derived(sumTeacherHoursForKind(data.lessons, 'extra'));

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
		for (const l of data.lessons) {
			counts[l.date] = (counts[l.date] ?? 0) + 1;
		}
		return Object.values(counts).some((n) => n > 1);
	});
	const pctDone = $derived.by(() => {
		const s = scheduledLessonCount(data.lessons);
		if (s === 0) return 0;
		return Math.round((doneLessonCount(data.lessons) / s) * 100);
	});

	const contractHoursLeft = $derived(totalUnschedTh);

	const contractScheduledPct = $derived(contractScheduledFillPercent(targetHours, scheduled));

	const contractScheduledFraction = $derived.by(() => {
		const target = Number(targetHours);
		const sched = scheduled;
		if (!Number.isFinite(target) || target <= 0) {
			return sched > 0 ? `${sched.toFixed(1)} h scheduled` : '—';
		}
		return `${sched.toFixed(1)} / ${target.toFixed(1)} h`;
	});

	type CompletionTier = 'done' | 'almost' | 'behind';

	const completionTier = $derived.by((): CompletionTier => {
		if (contractScheduledPct >= 100) return 'done';
		if (contractScheduledPct > 85) return 'almost';
		return 'behind';
	});

	const lessonExtraCaption = $derived.by(() => {
		const doneClass = doneLessonCount(data.lessons);
		const schedClass = scheduledLessonCount(data.lessons);
		const doneExtra = doneExtraSessionCount(data.lessons);
		const schedExtra = scheduledExtraSessionCount(data.lessons);
		return `${String(doneClass).padStart(2, '0')}/${String(schedClass).padStart(2, '0')} lesson · ${String(doneExtra).padStart(2, '0')}/${String(schedExtra).padStart(2, '0')} extra`;
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

	async function toggleDone(lesson: LessonRow, done: boolean) {
		await runMutation({
			fn: () => updateLesson(lesson.id, { done }),
			invalidate: classLessonsKey,
			errorToast: 'Could not update lesson.'
		});
	}

	async function removeLesson(id: string) {
		if (!window.confirm('Delete this lesson and its attendance?')) return;
		await runMutation({
			fn: () => deleteLessonCascade(id),
			invalidate: classLessonsKey,
			errorToast: 'Could not delete lesson.'
		});
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

	<div class="stats-layout">
		<div class="stats-summary" aria-label="Overview">
			<div class="stat-box">
				<span class="stat-box__title">Hours</span>
				<p class="size-8" aria-label="Contract hours left">
					{contractHoursLeft.toFixed(1)}<span class="size-8-unit">h</span>
				</p>
				<p class="size-4">{lessonExtraCaption}</p>
			</div>
			<div class="stat-box">
				<span class="stat-box__title">Summary</span>
				<p class="size-8 tier-{completionTier}" aria-label="Scheduled hours on contract">
					{contractScheduledPct}%
				</p>
				<p class="size-4 tier-{completionTier}-sub">{contractScheduledFraction}</p>
				<p class="size-4 completion-legend">
					<span class="legend-item" class:legend-active={completionTier === 'done'} data-tier="done"
						>done</span
					>
					<span aria-hidden="true"> | </span>
					<span class="legend-item" class:legend-active={completionTier === 'almost'} data-tier="almost"
						>almost</span
					>
					<span aria-hidden="true"> | </span>
					<span class="legend-item" class:legend-active={completionTier === 'behind'} data-tier="behind"
						>way behind</span
					>
				</p>
			</div>
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
			{doneLessonCount(data.lessons)} / {scheduledLessonCount(data.lessons)} ({pctDone}%)
		</p>
		<p>
			<strong>Extra sessions done:</strong>
			{doneExtraSessionCount(data.lessons)} / {scheduledExtraSessionCount(data.lessons)}
		</p>
		</div>
	</div>

	{#if dupDates}
		<p class="hint">Some dates have more than one lesson — allowed.</p>
	{/if}
</section>

<SemesterMap
	classRow={classSnapshot}
	lessons={data.lessons}
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
						<tr>
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
							<td>
								<input
									type="checkbox"
									checked={lesson.done}
									disabled={!lessonFormUi(lesson.sessionKind).doneEditable}
									title={lessonFormUi(lesson.sessionKind).doneDisabledTitle}
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
	.stats-layout {
		display: flex;
		flex-wrap: wrap;
		gap: 1.25rem;
		align-items: flex-start;
		margin-top: 0.5rem;
	}
	.stats-summary {
		display: flex;
		gap: 0.75rem;
		flex-shrink: 0;
	}
	.stat-box {
		padding: 1rem 1.15rem;
		border: 1px solid #e2e5eb;
		border-radius: 8px;
		background: #f8fafc;
		min-width: 9.5rem;
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
	.size-8-unit {
		font-size: 1.1rem;
		font-weight: 600;
		color: #94a3b8;
		margin-left: 0.1rem;
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
	.tier-done-sub,
	.tier-almost-sub,
	.tier-behind-sub {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.tier-done-sub {
		color: #16a34a;
	}
	.tier-almost-sub {
		color: #65a30d;
	}
	.tier-behind-sub {
		color: #9ca3af;
	}
	.completion-legend .legend-item {
		color: #cbd5e1;
	}
	.completion-legend .legend-item.legend-active {
		font-weight: 600;
	}
	.completion-legend .legend-item[data-tier='done'].legend-active {
		color: #16a34a;
	}
	.completion-legend .legend-item[data-tier='almost'].legend-active {
		color: #65a30d;
	}
	.completion-legend .legend-item[data-tier='behind'].legend-active {
		color: #9ca3af;
	}
	.stats {
		flex: 1;
		min-width: 16rem;
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
