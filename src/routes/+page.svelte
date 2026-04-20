<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { listClasses } from '$lib/repos/classes.repo';
	import { getLastClassId } from '$lib/preferences/activeClass';

	let empty = $state<boolean | null>(null);

	onMount(async () => {
		if (!browser) return;
		const classes = await listClasses();
		if (classes.length === 0) {
			empty = true;
			return;
		}
		empty = false;
		const last = getLastClassId();
		const id = last && classes.some((c) => c.id === last) ? last : classes[0].id;
		goto(`/class/${id}`);
	});
</script>

{#if empty === true}
	<section class="card">
		<h1>No classes yet</h1>
		<p>Use <strong>Create class</strong> in the header to add your first class.</p>
	</section>
{:else}
	<p class="muted">Loading…</p>
{/if}

<style>
	.card {
		background: #fff;
		padding: 1.5rem;
		border-radius: 8px;
		border: 1px solid #e2e5eb;
	}
	.muted {
		color: #666;
	}
</style>
