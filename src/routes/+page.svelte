<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

{#if 'empty' in data && data.empty}
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
