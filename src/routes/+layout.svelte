<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { flushAllPending } from '$lib/persistence/flush';
	import { CLASSES_LIST_LOAD_KEY, classMetaLoadKey, classScopeLoadKeys } from '$lib/kit/loadKeys';
	import { runMutation } from '$lib/kit/runMutation';
	import { getToastMessage } from '$lib/ui/toast.svelte';
	import {
		createClassAndLinkFolder,
		deleteClassCascade,
		updateClass
	} from '$lib/application/classes';
	import { getSaveStatus } from '$lib/ui/saveStatus.svelte';
	import { clearLastClassId } from '$lib/preferences/activeClass';

	let { data, children } = $props();

	onMount(() => {
		const onBeforeUnload = () => flushAllPending();
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	});

	const toast = $derived(getToastMessage());
	const classes = $derived(data.classes);
	const saveStatus = $derived(getSaveStatus());

	const routeClassId = $derived(
		typeof page.params.classId === 'string' ? page.params.classId : ''
	);

	async function onNewClass() {
		const name = window.prompt('Class name?');
		if (!name?.trim()) return;
		await runMutation({
			fn: () => createClassAndLinkFolder({ name: name.trim(), totalHoursTarget: 40 }),
			invalidate: CLASSES_LIST_LOAD_KEY,
			errorToast: 'Could not create class.',
			onSuccess: async (c) => {
				await goto(`/class/${c.id}`);
			}
		});
	}

	async function onRenameClass() {
		if (!routeClassId) return;
		const current = classes.find((c) => c.id === routeClassId)?.name ?? '';
		const name = window.prompt('Rename class', current);
		const trimmed = name?.trim() ?? '';
		if (!trimmed || trimmed === current.trim()) return;
		await runMutation({
			fn: () => updateClass(routeClassId, { name: trimmed }),
			invalidate: [CLASSES_LIST_LOAD_KEY, classMetaLoadKey(routeClassId)],
			errorToast: 'Could not rename class.'
		});
	}

	async function onDeleteClass() {
		if (!routeClassId) return;
		if (!window.confirm('Delete this class and all its data?')) return;
		await runMutation({
			fn: () => deleteClassCascade(routeClassId),
			invalidate: [CLASSES_LIST_LOAD_KEY, ...classScopeLoadKeys(routeClassId)],
			errorToast: 'Could not delete class.',
			onSuccess: async () => {
				clearLastClassId();
				await goto('/');
			}
		});
	}

	function onClassChange(e: Event) {
		const v = (e.currentTarget as HTMLSelectElement).value;
		if (v) goto(`/class/${v}`);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app">
	<header class="bar">
		<strong class="brand">Lesson planner</strong>
		{#if classes.length > 0}
			<label class="sr" for="class-switcher">Class</label>
			<select id="class-switcher" class="select" value={routeClassId} onchange={onClassChange}>
				{#each classes as c (c.id)}
					<option value={c.id}>{c.name}</option>
				{/each}
			</select>
			<button type="button" class="btn" onclick={onNewClass}>New class</button>
			{#if routeClassId}
				<button type="button" class="btn" onclick={onRenameClass}>Rename</button>
				<button type="button" class="btn danger" onclick={onDeleteClass}>Delete class</button>
			{/if}
		{:else}
			<button type="button" class="btn" onclick={onNewClass}>Create class</button>
		{/if}
		{#if saveStatus !== 'idle'}
			<span class="save-status" class:saving={saveStatus === 'saving'} class:saved={saveStatus === 'saved'} class:failed={saveStatus === 'failed'}>
				{#if saveStatus === 'saving'}
					Saving…
				{:else if saveStatus === 'saved'}
					Saved
				{:else if saveStatus === 'failed'}
					Save failed
				{/if}
			</span>
		{/if}
	</header>

	{#if data.fileStorageUnsupported}
		<div class="banner" role="alert">
			This browser does not support saving to folders. Use Chrome or Edge.
		</div>
	{/if}

	{#if toast}
		<div class="toast" role="status">{toast}</div>
	{/if}

	<main class="main">
		{@render children()}
	</main>
</div>

<style>
	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
		line-height: 1.5;
		color: #1a1a1a;
		background: #f6f7f9;
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: #fff;
		border-bottom: 1px solid #e2e5eb;
	}
	.brand {
		margin-right: auto;
	}
	.select {
		min-width: 12rem;
		padding: 0.35rem 0.5rem;
	}
	.btn {
		padding: 0.35rem 0.75rem;
		border: 1px solid #c9ced6;
		background: #fff;
		border-radius: 6px;
		cursor: pointer;
	}
	.btn:hover {
		background: #f0f2f5;
	}
	.btn.danger {
		border-color: #e08585;
		color: #a32020;
	}
	.save-status {
		font-size: 0.875rem;
		color: #6b7280;
	}
	.save-status.saving {
		color: #6b7280;
	}
	.save-status.saved {
		color: #059669;
	}
	.save-status.failed {
		color: #dc2626;
	}
	.banner {
		margin: 0 1rem;
		padding: 0.5rem 0.75rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 6px;
		color: #991b1b;
	}
	.main {
		flex: 1;
		padding: 1rem;
		max-width: 960px;
		width: 100%;
		margin: 0 auto;
	}
	.toast {
		margin: 0 1rem;
		padding: 0.5rem 0.75rem;
		background: #fff3cd;
		border: 1px solid #e6d89c;
		border-radius: 6px;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}
</style>
