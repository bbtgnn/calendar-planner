<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { CLASSES_LIST_LOAD_KEY } from '$lib/kit/loadKeys';
	import { toastMessage } from '$lib/stores/toast';
	import { createClass, deleteClassCascade, updateClass } from '$lib/repos/classes.repo';
	import { withRetry } from '$lib/db/withRetry';
	import { showToast } from '$lib/stores/toast';
	import { clearLastClassId } from '$lib/preferences/activeClass';

	let { data, children } = $props();

	const classes = $derived(data.classes);

	const routeClassId = $derived(
		typeof page.params.classId === 'string' ? page.params.classId : ''
	);

	async function onNewClass() {
		const name = window.prompt('Class name?');
		if (!name?.trim()) return;
		try {
			const c = await withRetry(() =>
				createClass({ name: name.trim(), totalHoursTarget: 40 })
			);
			await invalidate(CLASSES_LIST_LOAD_KEY);
			await goto(`/class/${c.id}`);
		} catch {
			showToast('Could not create class.');
		}
	}

	async function onRenameClass() {
		if (!routeClassId) return;
		const current = classes.find((c) => c.id === routeClassId)?.name ?? '';
		const name = window.prompt('Rename class', current);
		const trimmed = name?.trim() ?? '';
		if (!trimmed || trimmed === current.trim()) return;
		try {
			await withRetry(() => updateClass(routeClassId, { name: trimmed }));
			await invalidate(CLASSES_LIST_LOAD_KEY);
		} catch {
			showToast('Could not rename class.');
		}
	}

	async function onDeleteClass() {
		if (!routeClassId) return;
		if (!window.confirm('Delete this class and all its data?')) return;
		try {
			await withRetry(() => deleteClassCascade(routeClassId));
			clearLastClassId();
			await invalidate(CLASSES_LIST_LOAD_KEY);
			await goto('/');
		} catch {
			showToast('Could not delete class.');
		}
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
	</header>

	{#if $toastMessage}
		<div class="toast" role="status">{$toastMessage}</div>
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
