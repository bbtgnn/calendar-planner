<script lang="ts">
	import type { ClassRow, LessonRow } from '$lib/db/types';
	import { classMetaLoadKey } from '$lib/kit/loadKeys';
	import { runMutation } from '$lib/kit/runMutation';
	import { updateClass } from '$lib/application/classes';
	import { showToast } from '$lib/ui/toast.svelte';
	import { formatYearMonthHeading } from '$lib/logic/dateFormat';
	import {
		assertValidSemesterBounds,
		isDateInSemester,
		listYearMonthsInRange,
		monthGridMondayFirst,
		toUtcIsoCalendarDate,
		uniqueKindsByDate
	} from '$lib/logic/semesterCalendar';

	type Props = {
		classRow: ClassRow;
		lessons: LessonRow[];
		onSemesterSaved?: (next: ClassRow) => void;
	};

	let { classRow: klass, lessons, onSemesterSaved }: Props = $props();

	let startInput = $state('');
	let endInput = $state('');

	$effect(() => {
		startInput = klass.semesterStart ?? '';
		endInput = klass.semesterEnd ?? '';
	});

	const kindsMap = $derived(uniqueKindsByDate(lessons));

	async function saveSemester() {
		const a = startInput.trim();
		const b = endInput.trim();
		if (a === '' && b === '') {
			await runMutation({
				fn: () => updateClass(klass.id, { semesterStart: null, semesterEnd: null }),
				invalidate: classMetaLoadKey(klass.id),
				successToast: 'Semester cleared.',
				onSuccess: () =>
					onSemesterSaved?.({
						...klass,
						semesterStart: null,
						semesterEnd: null
					})
			});
			return;
		}
		if (a === '' || b === '') {
			showToast('Set both semester start and end, or clear both.');
			return;
		}
		try {
			assertValidSemesterBounds(a, b);
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Could not save semester.';
			showToast(msg);
			return;
		}
		await runMutation({
			fn: () => updateClass(klass.id, { semesterStart: a, semesterEnd: b }),
			invalidate: classMetaLoadKey(klass.id),
			successToast: 'Semester saved.',
			errorToast: 'Could not save semester.',
			onSuccess: () =>
				onSemesterSaved?.({
					...klass,
					semesterStart: a,
					semesterEnd: b
				})
		});
	}

	const stripVisible = $derived(klass.semesterStart !== null && klass.semesterEnd !== null);

	const yearMonths = $derived(
		stripVisible && klass.semesterStart && klass.semesterEnd
			? listYearMonthsInRange(klass.semesterStart, klass.semesterEnd)
			: []
	);

	const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	/** UTC calendar day, aligned with {@link monthGridMondayFirst} cell `isoDate` values. */
	const todayUtcIso = $derived(toUtcIsoCalendarDate(new Date()));
</script>

<section class="semester-card">
	<h2>Semester</h2>
	<div class="grid sem-grid">
		<label>
			Start
			<input type="date" bind:value={startInput} />
		</label>
		<label>
			End
			<input type="date" bind:value={endInput} />
		</label>
		<button type="button" class="btn" onclick={() => void saveSemester()}>Save semester</button>
	</div>
	{#if !stripVisible}
		<p class="muted">Set semester start and end to see the map.</p>
	{:else}
		<div class="legend">
			<span><i class="dot class"></i> Class</span>
			<span><i class="dot extra"></i> Extra / 1:1</span>
			<span><i class="dot skipped"></i> Skipped</span>
		</div>
		<div class="strip" role="region" aria-label="Semester months">
			{#each yearMonths as ym (ym)}
				<div class="mini-month">
					<h3 class="month-title">{formatYearMonthHeading(ym)}</h3>
					<div class="dow">
						{#each weekdays as w}<span>{w}</span>{/each}
					</div>
					<div class="cells">
						{#each monthGridMondayFirst(ym) as cell, ci (`${ym}-${ci}`)}
							{@const inS =
								klass.semesterStart &&
								klass.semesterEnd &&
								isDateInSemester(cell.isoDate, klass.semesterStart, klass.semesterEnd)}
							{@const isToday = cell.isoDate === todayUtcIso}
							<div
								class="cell"
								class:semester-out={!inS}
								class:out-month={!cell.inMonth && inS}
								class:today={isToday}
								aria-current={isToday ? 'date' : undefined}
							>
								<span class="dnum">{Number(cell.isoDate.slice(8))}</span>
								{#if inS}
									<div class="dots">
										{#each [...(kindsMap.get(cell.isoDate) ?? [])].sort() as k (k)}
											<i class="dot {k}"></i>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.semester-card {
		--dot-class-bg: #dcfce7;
		--dot-class-border: #16a34a;
		--dot-extra-bg: #dbeafe;
		--dot-extra-border: #2563eb;
		--dot-skipped-bg: #fee2e2;
		--dot-skipped-border: #dc2626;
		background: #fff;
		padding: 1.25rem;
		border-radius: 8px;
		border: 1px solid #e2e5eb;
		margin-bottom: 1rem;
	}
	h2 {
		margin: 0 0 0.75rem;
		font-size: 1.1rem;
	}
	h3.month-title {
		margin: 0 0 0.35rem;
		font-size: 0.8rem;
		font-weight: 600;
	}
	.sem-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: flex-end;
		margin-bottom: 0.5rem;
	}
	.sem-grid label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
	}
	.btn {
		padding: 0.4rem 0.75rem;
		border: 1px solid #c9ced6;
		background: #fff;
		border-radius: 6px;
		cursor: pointer;
		align-self: center;
	}
	.muted {
		color: #666;
		font-size: 0.9rem;
		margin: 0.25rem 0 0;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1rem;
		font-size: 0.8rem;
		margin: 0.5rem 0;
		align-items: center;
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.strip {
		display: flex;
		flex-direction: row;
		gap: 0.65rem;
		overflow-x: auto;
		padding-bottom: 0.25rem;
	}
	.mini-month {
		flex: 0 0 auto;
		min-width: 168px;
		border: 1px solid #e2e5eb;
		border-radius: 6px;
		padding: 0.35rem 0.4rem 0.5rem;
		background: #fafbff;
	}
	.dow {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		font-size: 0.6rem;
		color: #555;
		text-align: center;
		margin-bottom: 0.15rem;
	}
	.cells {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 1px;
	}
	.cell {
		min-height: 2.1rem;
		border-radius: 3px;
		background: #fff;
		border: 1px solid #eceef2;
		padding: 0.1rem 0.15rem;
		font-size: 0.65rem;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.cell.semester-out {
		opacity: 0.38;
		background: #f4f4f4;
	}
	/** Leading/trailing week days from other months, still inside semester: muted cell, dots fainter */
	.cell.out-month {
		background: #f0f2f5;
		border-color: #e0e3e8;
	}
	.cell.out-month .dnum {
		color: #5f6368;
		opacity: 0.88;
	}
	.cell.today {
		outline: 2px solid #1967d2;
		outline-offset: -1px;
		background: #e8f0fe;
		z-index: 1;
	}
	.cell.semester-out.today {
		opacity: 1;
		background: #e3e9f4;
	}
	.cell.out-month.today {
		background: #d9e6fc;
	}
	.dnum {
		font-weight: 600;
		line-height: 1;
	}
	.dots {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		justify-content: center;
		margin-top: 2px;
		min-height: 0.5rem;
	}
	i.dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		box-sizing: border-box;
		border: 1px solid transparent;
		font-style: normal;
	}
	.cell.out-month .dots i.dot {
		opacity: 0.35;
	}
	i.dot.class {
		background: var(--dot-class-bg);
		border-color: var(--dot-class-border);
	}
	i.dot.extra {
		background: var(--dot-extra-bg);
		border-color: var(--dot-extra-border);
	}
	i.dot.skipped {
		background: var(--dot-skipped-bg);
		border-color: var(--dot-skipped-border);
	}
	input[type='date'] {
		padding: 0.35rem 0.5rem;
		border: 1px solid #c9ced6;
		border-radius: 6px;
	}
</style>
