<script lang="ts">
	import { formatYearMonthHeading, DATE_DISPLAY_LOCALE } from '$lib/logic/dateFormat';
	import {
		addYearMonth,
		countsForDate,
		isFullDay,
		yearMonthInOverviewSpan,
		type DayCounts,
		type OverviewSpan
	} from '$lib/logic/overviewCalendar';
	import { isDateInSemester, monthGridMondayFirst, toUtcIsoCalendarDate } from '$lib/logic/semesterCalendar';

	type Props = {
		span: OverviewSpan;
		index: Map<string, DayCounts>;
		yearMonth: string;
	};

	let { span, index, yearMonth = $bindable() }: Props = $props();

	const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const todayUtcIso = $derived(toUtcIsoCalendarDate(new Date()));
	const cells = $derived(monthGridMondayFirst(yearMonth));
	const canPrev = $derived(yearMonthInOverviewSpan(addYearMonth(yearMonth, -1), span));
	const canNext = $derived(yearMonthInOverviewSpan(addYearMonth(yearMonth, 1), span));

	let dialogEl = $state<HTMLDialogElement | null>(null);
	let selectedDate = $state<string | null>(null);
	const selectedCounts = $derived(
		selectedDate ? countsForDate(index, selectedDate) : null
	);

	function formatDayHeading(iso: string): string {
		const [y, m, d] = iso.split('-').map(Number);
		return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(DATE_DISPLAY_LOCALE, {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		});
	}

	function openDetail(iso: string) {
		selectedDate = iso;
		dialogEl?.showModal();
	}

	function closeDetail() {
		dialogEl?.close();
		selectedDate = null;
	}

	function goPrev() {
		if (canPrev) yearMonth = addYearMonth(yearMonth, -1);
	}

	function goNext() {
		if (canNext) yearMonth = addYearMonth(yearMonth, 1);
	}
</script>

<div class="month-nav">
	<button type="button" class="btn nav" disabled={!canPrev} onclick={goPrev} aria-label="Previous month">
		‹
	</button>
	<h2 class="month-title">{formatYearMonthHeading(yearMonth)}</h2>
	<button type="button" class="btn nav" disabled={!canNext} onclick={goNext} aria-label="Next month">
		›
	</button>
</div>

<div class="legend" aria-hidden="true">
	<span><i class="swatch normal"></i> Normal day</span>
	<span><i class="swatch full"></i> Full day (2+ lessons)</span>
</div>

<div class="calendar" role="region" aria-label="Overview month">
	<div class="dow">
		{#each weekdays as w}<span>{w}</span>{/each}
	</div>
	<div class="cells">
		{#each cells as cell, ci (`${yearMonth}-${ci}`)}
			{@const inSpan = isDateInSemester(cell.isoDate, span.start, span.end)}
			{@const counts = countsForDate(index, cell.isoDate)}
			{@const full = counts != null && isFullDay(counts.total)}
			{@const isToday = cell.isoDate === todayUtcIso}
			{#if full}
				<button
					type="button"
					class="cell full"
					class:out-month={!cell.inMonth}
					class:span-out={!inSpan}
					class:today={isToday}
					aria-current={isToday ? 'date' : undefined}
					aria-label="{formatDayHeading(cell.isoDate)}, {counts!.total} lessons"
					onclick={() => openDetail(cell.isoDate)}
				>
					<span class="dnum">{Number(cell.isoDate.slice(8))}</span>
					<span class="badge" aria-hidden="true">2+</span>
				</button>
			{:else}
				<div
					class="cell"
					class:out-month={!cell.inMonth}
					class:span-out={!inSpan}
					class:today={isToday}
					aria-current={isToday ? 'date' : undefined}
				>
					<span class="dnum">{Number(cell.isoDate.slice(8))}</span>
				</div>
			{/if}
		{/each}
	</div>
</div>

<dialog
	bind:this={dialogEl}
	class="detail-dialog"
	onclose={closeDetail}
	aria-labelledby="overview-detail-title"
>
	{#if selectedDate && selectedCounts}
		<h3 id="overview-detail-title">{formatDayHeading(selectedDate)}</h3>
		<p class="total">
			{selectedCounts.total} lesson{selectedCounts.total === 1 ? '' : 's'}
		</p>
		<ul class="by-class">
			{#each selectedCounts.byClass as row (row.classId)}
				<li>
					<span>{row.className} — {row.count}</span>
					<a href="/class/{row.classId}">Go to class</a>
				</li>
			{/each}
		</ul>
	{/if}
	<form method="dialog">
		<button type="submit" class="btn">Close</button>
	</form>
</dialog>

<style>
	.month-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}
	.month-title {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
		flex: 1;
		text-align: center;
	}
	.btn {
		padding: 0.35rem 0.75rem;
		border: 1px solid #c9ced6;
		background: #fff;
		border-radius: 6px;
		cursor: pointer;
		font: inherit;
	}
	.btn.nav {
		min-width: 2.25rem;
		font-size: 1.25rem;
		line-height: 1;
		padding: 0.25rem 0.5rem;
	}
	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1rem;
		font-size: 0.8rem;
		margin-bottom: 0.75rem;
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.swatch {
		display: inline-block;
		width: 1rem;
		height: 1rem;
		border-radius: 3px;
		border: 1px solid #eceef2;
		font-style: normal;
	}
	.swatch.normal {
		background: #fff;
	}
	.swatch.full {
		background: #fff7ed;
		border-color: #fdba74;
	}
	.dow {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		font-size: 0.75rem;
		color: #555;
		text-align: center;
		margin-bottom: 0.25rem;
	}
	.cells {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
	}
	.cell {
		min-height: 2.75rem;
		border-radius: 4px;
		background: #fff;
		border: 1px solid #eceef2;
		padding: 0.2rem 0.15rem;
		font-size: 0.8rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		font: inherit;
		color: inherit;
	}
	button.cell {
		cursor: pointer;
		text-align: center;
	}
	button.cell:hover {
		filter: brightness(0.97);
	}
	button.cell:focus-visible {
		outline: 2px solid #1967d2;
		outline-offset: 1px;
	}
	.cell.full {
		background: #fff7ed;
		border-color: #fdba74;
	}
	.cell.span-out,
	.cell.out-month {
		opacity: 0.45;
		background: #f4f4f4;
	}
	.cell.today {
		outline: 2px solid #1967d2;
		outline-offset: -1px;
	}
	.cell.full.today {
		background: #ffedd5;
	}
	.dnum {
		font-weight: 600;
		line-height: 1.2;
	}
	.badge {
		font-size: 0.6rem;
		font-weight: 700;
		color: #c2410c;
		margin-top: 0.15rem;
	}
	.detail-dialog {
		border: 1px solid #e2e5eb;
		border-radius: 8px;
		padding: 1rem 1.25rem;
		max-width: 22rem;
		box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
	}
	.detail-dialog::backdrop {
		background: rgb(0 0 0 / 25%);
	}
	.detail-dialog h3 {
		margin: 0 0 0.35rem;
		font-size: 1rem;
	}
	.total {
		margin: 0 0 0.75rem;
		color: #444;
		font-size: 0.9rem;
	}
	.by-class {
		list-style: none;
		margin: 0 0 1rem;
		padding: 0;
	}
	.by-class li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.35rem 0.75rem;
		padding: 0.35rem 0;
		border-bottom: 1px solid #eceef2;
		font-size: 0.9rem;
	}
	.by-class a {
		font-size: 0.85rem;
	}
	@media (max-width: 640px) {
		.detail-dialog {
			margin: auto auto 0;
			max-width: none;
			width: 100%;
			border-radius: 12px 12px 0 0;
		}
	}
</style>
