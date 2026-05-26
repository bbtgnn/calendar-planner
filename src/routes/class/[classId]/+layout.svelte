<script lang="ts">
	import { page } from '$app/state';
	import { setLastClassId } from '$lib/preferences/activeClass';
	import { ensureReadWritePermission, hasFolderPermission } from '$lib/persistence/classFolder';
	import { getFolderHandle, putFolderHandle } from '$lib/persistence/meta';
	import { pickClassFolder } from '$lib/persistence/linkClass';
	import { showToast } from '$lib/ui/toast.svelte';

	let { data, children } = $props();

	const classId = $derived(data.class.id);
	const path = $derived(page.url.pathname);

	let needsReconnect = $state(false);
	let reconnecting = $state(false);

	$effect(() => {
		setLastClassId(classId);
	});

	$effect(() => {
		if (!data.fileStorageSupported) return;

		const id = classId;
		let cancelled = false;

		void (async () => {
			const handle = await getFolderHandle(id);
			if (cancelled) return;
			if (!handle) {
				needsReconnect = false;
				return;
			}
			needsReconnect = !(await hasFolderPermission(handle, 'readwrite'));
		})();

		return () => {
			cancelled = true;
		};
	});

	async function onReconnect() {
		if (reconnecting) return;
		const handle = await pickClassFolder();
		if (!handle) return;

		reconnecting = true;
		try {
			if (!(await ensureReadWritePermission(handle))) {
				showToast('Could not access folder — reconnect to continue saving.');
				return;
			}
			await putFolderHandle(classId, handle);
			needsReconnect = false;
		} finally {
			reconnecting = false;
		}
	}

	const scheduleActive = $derived(
		path === `/class/${classId}` || path.startsWith(`/class/${classId}/lesson/`)
	);
</script>

{#if needsReconnect}
	<div class="banner" role="alert">
		<p>Folder access lost — changes may not save to disk.</p>
		<button type="button" class="btn" disabled={reconnecting} onclick={onReconnect}>
			{reconnecting ? 'Reconnecting…' : 'Reconnect folder'}
		</button>
	</div>
{/if}

<nav class="sub" aria-label="Class sections">
	<a
		href="/class/{classId}"
		class:active={scheduleActive}
		data-sveltekit-preload-data="tap">Schedule</a>
	<a
		href="/class/{classId}/students"
		class:active={path.startsWith(`/class/${classId}/students`)}
		data-sveltekit-preload-data="tap">Students</a>
</nav>

{@render children()}

<style>
	.banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 1rem;
		padding: 0.75rem 1rem;
		background: #fff8e6;
		border: 1px solid #f0d080;
		border-radius: 6px;
		color: #5c4a1a;
	}
	.banner p {
		margin: 0;
	}
	.btn {
		padding: 0.35rem 0.75rem;
		border: 1px solid #c9ced6;
		background: #fff;
		border-radius: 6px;
		cursor: pointer;
		font: inherit;
		white-space: nowrap;
	}
	.btn:hover:not(:disabled) {
		background: #f0f2f5;
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.sub {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.sub a {
		padding: 0.35rem 0.75rem;
		border-radius: 6px;
		text-decoration: none;
		color: #334;
		border: 1px solid transparent;
	}
	.sub a:hover {
		background: #e9ecf1;
	}
	.sub a.active {
		background: #fff;
		border-color: #c9ced6;
		font-weight: 600;
	}
</style>
