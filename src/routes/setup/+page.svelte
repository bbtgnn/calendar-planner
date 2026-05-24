<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { pickClassFolder, linkClassToPickedFolder } from '$lib/persistence/linkClass';
	import { showToast } from '$lib/ui/toast.svelte';

	let { data }: { data: PageData } = $props();

	let linkingId = $state<string | null>(null);

	async function onChooseFolder(classId: string) {
		if (linkingId) return;
		const handle = await pickClassFolder();
		if (!handle) return;

		linkingId = classId;
		try {
			const ok = await linkClassToPickedFolder(classId, handle);
			if (!ok) {
				showToast('Could not access folder — reconnect to continue saving.');
				return;
			}
			await invalidateAll();
		} finally {
			linkingId = null;
		}
	}
</script>

{#if data.unsupported}
	<div class="panel">
		<h1>Link class folders</h1>
		<p class="error" role="alert">
			This browser does not support saving to folders. Use Chrome or Edge.
		</p>
	</div>
{:else}
	<div class="panel">
		<h1>Link class folders</h1>
		<p class="warn">Link a folder for each class to continue.</p>

		<ul class="list">
			{#each data.classes as c (c.id)}
				<li class="row">
					<span class="name">{c.name}</span>
					<button
						type="button"
						class="btn"
						disabled={linkingId !== null}
						onclick={() => onChooseFolder(c.id)}
					>
						{linkingId === c.id ? 'Linking…' : 'Choose folder'}
					</button>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.panel {
		max-width: 36rem;
		margin: 2rem auto;
		padding: 1.5rem;
		background: #fff;
		border: 1px solid #e2e5eb;
		border-radius: 8px;
	}
	h1 {
		margin: 0 0 0.75rem;
		font-size: 1.25rem;
	}
	.warn {
		margin: 0 0 1rem;
		color: #5c6370;
	}
	.error {
		margin: 0;
		color: #b42318;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem;
		border: 1px solid #e2e5eb;
		border-radius: 6px;
		background: #f6f7f9;
	}
	.name {
		font-weight: 500;
	}
	.btn {
		padding: 0.35rem 0.75rem;
		border: 1px solid #c9ced6;
		background: #fff;
		border-radius: 6px;
		cursor: pointer;
		font: inherit;
	}
	.btn:hover:not(:disabled) {
		background: #f0f2f5;
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
