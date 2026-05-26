<script lang="ts">
	import type { PageData } from './$types';
	import OverviewMonthGrid from './OverviewMonthGrid.svelte';
	import { formatIsoDate } from '$lib/logic/dateFormat';
	import {
		defaultOverviewYearMonth,
		type DayCounts
	} from '$lib/logic/overviewCalendar';
	import { toUtcIsoCalendarDate } from '$lib/logic/semesterCalendar';

	let { data }: { data: PageData } = $props();

	const span = $derived(data.span);
	const excluded = $derived(data.excluded);
	const index = $derived(new Map<string, DayCounts>(data.dayIndexEntries ?? []));

	let yearMonth = $state('');
	let initializedSpanKey = $state('');

	const spanKey = $derived(span ? `${span.start}:${span.end}` : '');

	$effect(() => {
		if (!span) {
			yearMonth = '';
			initializedSpanKey = '';
			return;
		}
		if (initializedSpanKey !== spanKey) {
			initializedSpanKey = spanKey;
			yearMonth = defaultOverviewYearMonth(span, toUtcIsoCalendarDate(new Date()));
		}
	});
</script>

{#if data.classes.length === 0}
	<section class="card">
		<h1>Lesson overview</h1>
		<p>Use <strong>Create class</strong> in the header to add your first class.</p>
	</section>
{:else if !span}
	<section class="card">
		<h1>Lesson overview</h1>
		<p class="muted">Set semester start and end on each class to see the overview.</p>
		<ul class="class-links">
			{#each data.classes as c (c.id)}
				<li><a href="/class/{c.id}">{c.name}</a></li>
			{/each}
		</ul>
	</section>
{:else}
	<section class="card">
		<h1>Lesson overview</h1>
		<p class="muted">Days with at least 2 lessons across your classes</p>
		<p class="range">From {formatIsoDate(span.start)} to {formatIsoDate(span.end)}</p>
		{#if excluded.length > 0}
			<p class="note">
				{excluded.length} class{excluded.length === 1 ? '' : 'es'} without a semester not included:
				{excluded.map((c) => c.name).join(', ')}
			</p>
		{/if}
		{#if yearMonth}
			<OverviewMonthGrid {span} {index} bind:yearMonth />
		{/if}
	</section>
{/if}

<style>
	.card {
		background: #fff;
		padding: 1.5rem;
		border-radius: 8px;
		border: 1px solid #e2e5eb;
	}
	h1 {
		margin: 0 0 0.35rem;
		font-size: 1.35rem;
	}
	.muted {
		color: #666;
		margin: 0;
	}
	.range {
		font-size: 0.9rem;
		margin: 0.25rem 0 1rem;
	}
	.note {
		font-size: 0.85rem;
		color: #5c4a1a;
		background: #fff8e6;
		border: 1px solid #f0d080;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		margin: 0 0 1rem;
	}
	.class-links {
		margin: 0.75rem 0 0;
		padding-left: 1.25rem;
	}
</style>
