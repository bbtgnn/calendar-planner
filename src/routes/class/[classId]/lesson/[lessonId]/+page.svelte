<script lang="ts">
	import { invalidate } from '$app/navigation';
	import type { PageData } from './$types';
	import { lessonLoadKey } from '$lib/kit/loadKeys';
	import { updateLesson } from '$lib/repos/lessons.repo';
	import {
		attendanceVisibleForKind,
		doneEditableForKind,
		hoursEditableForKind,
		labelForTitleField,
		normalizedHoursForKind
	} from '$lib/logic/sessionKindUi';
	import { setAbsent } from '$lib/repos/attendance.repo';
	import { withRetry } from '$lib/db/withRetry';
	import { showToast } from '$lib/stores/toast';
	import type { LessonSessionKind } from '$lib/db/types';

	let { data }: { data: PageData } = $props();

	let date = $state('');
	let durationHours = $state(0);
	let title = $state('');
	let done = $state(false);
	let sessionKind = $state<LessonSessionKind>('class');

	const formSeed = $derived(
		`${data.lesson.id}|${data.lesson.date}|${data.lesson.durationHours}|${data.lesson.title}|${data.lesson.done}|${data.lesson.sessionKind}`
	);

	let absent = $state<Set<string>>(new Set());

	$effect(() => {
		const _ = formSeed;
		const l = data.lesson;
		date = l.date;
		durationHours = l.durationHours;
		title = l.title;
		done = l.done;
		sessionKind = l.sessionKind;
	});

	const absentSeed = $derived(data.absentIds.join('\0'));

	$effect(() => {
		const _ = absentSeed;
		absent = new Set(data.absentIds);
	});

	async function revalidateLesson() {
		await invalidate(lessonLoadKey(data.lesson.id));
	}

	async function persistLessonMeta() {
		const h = Number(durationHours);
		if (!Number.isFinite(h) || h < 0) {
			showToast('Enter a valid non-negative number of hours.');
			return;
		}
		try {
			await withRetry(() =>
				updateLesson(data.lesson.id, {
					date,
					durationHours: normalizedHoursForKind(sessionKind, h),
					title,
					done: doneEditableForKind(sessionKind) ? done : false,
					sessionKind
				})
			);
		} catch {
			showToast('Could not save lesson.');
		}
	}

	async function changeSessionKind(next: LessonSessionKind) {
		const prev = sessionKind;
		const prevDurationHours = durationHours;
		const prevDone = done;
		const nextHours = normalizedHoursForKind(next, Number(durationHours));
		const nextDone = doneEditableForKind(next) ? done : false;
		sessionKind = next;
		durationHours = nextHours;
		done = nextDone;
		try {
			await withRetry(() =>
				updateLesson(data.lesson.id, {
					sessionKind: next,
					durationHours: nextHours,
					done: nextDone
				})
			);
			await revalidateLesson();
		} catch (e) {
			sessionKind = prev;
			durationHours = prevDurationHours;
			done = prevDone;
			const msg = e instanceof Error ? e.message : String(e);
			if (msg.includes('SESSION_KIND_EXTRA_BLOCKED_ABSENCES')) {
				showToast('Clear all absences for this session before marking it as Extra.');
			} else {
				showToast('Could not update session kind.');
			}
		}
	}

	async function toggleAbsent(studentId: string, isAbsent: boolean) {
		const next = new Set(absent);
		if (isAbsent) next.add(studentId);
		else next.delete(studentId);
		absent = next;
		try {
			await withRetry(() => setAbsent(data.lesson.id, studentId, isAbsent));
		} catch {
			showToast('Could not save attendance.');
			await revalidateLesson();
		}
	}
</script>

<section class="card">
	<p class="back">
		<a href={`/class/${data.lesson.classId}`}>← Back to schedule</a>
	</p>
	<h1>{title}</h1>

	<div class="grid">
		<label>
			Date
			<input type="date" bind:value={date} onblur={persistLessonMeta} />
		</label>
		<label>
			Hours
			<input
				type="number"
				min="0"
				step="0.25"
				bind:value={durationHours}
				disabled={!hoursEditableForKind(sessionKind)}
				onblur={persistLessonMeta}
			/>
		</label>
		<label>
			{labelForTitleField(sessionKind)}
			<input type="text" bind:value={title} onblur={persistLessonMeta} />
		</label>
		<label>
			Kind
			<select
				value={sessionKind}
				onchange={(e) => {
					const v = (e.currentTarget as HTMLSelectElement).value as LessonSessionKind;
					void changeSessionKind(v);
				}}
			>
				<option value="class">Class</option>
				<option value="extra">Extra / 1:1</option>
				<option value="skipped">Skipped</option>
			</select>
		</label>
		<label class="check">
			<input
				type="checkbox"
				bind:checked={done}
				disabled={!doneEditableForKind(sessionKind)}
				onchange={() => {
					if (!doneEditableForKind(sessionKind)) {
						done = false;
						return;
					}
					void persistLessonMeta();
				}}
			/>
			Done
		</label>
	</div>
</section>

<section class="card">
	<h2>Attendance</h2>
	{#if !attendanceVisibleForKind(sessionKind)}
		<p class="muted">
			{sessionKind === 'skipped'
				? 'Skipped sessions do not have attendance.'
				: 'No class attendance for Extra / 1:1 sessions.'}
		</p>
	{:else if data.students.length === 0}
		<p class="muted">Add students on the Students tab to record absences.</p>
	{:else}
		<p class="hint">Everyone is present unless marked absent.</p>
		<ul class="list">
			{#each data.students as s (s.id)}
				<li>
					<span>{s.name}</span>
					<label>
						<input
							type="checkbox"
							checked={absent.has(s.id)}
							onchange={(e) =>
								toggleAbsent(s.id, (e.currentTarget as HTMLInputElement).checked)}
						/>
						Absent
					</label>
				</li>
			{/each}
		</ul>
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
	.back {
		margin: 0 0 0.5rem;
	}
	h1 {
		margin: 0 0 1rem;
		font-size: 1.25rem;
	}
	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.05rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: 0.75rem;
		align-items: end;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
	}
	.check {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
	}
	input[type='date'],
	input[type='number'],
	input[type='text'],
	select {
		padding: 0.35rem 0.5rem;
		border: 1px solid #c9ced6;
		border-radius: 6px;
	}
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.list li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 0.4rem 0;
		border-bottom: 1px solid #eef0f3;
	}
	.hint {
		font-size: 0.9rem;
		color: #444;
	}
	.muted {
		color: #666;
	}
</style>
