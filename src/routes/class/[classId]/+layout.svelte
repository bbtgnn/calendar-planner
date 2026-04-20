<script lang="ts">
	import { page } from '$app/state';
	import { setLastClassId } from '$lib/preferences/activeClass';

	let { data, children } = $props();

	const classId = $derived(data.class.id);
	const path = $derived(page.url.pathname);

	$effect(() => {
		setLastClassId(classId);
	});

	const scheduleActive = $derived(
		path === `/class/${classId}` || path.startsWith(`/class/${classId}/lesson/`)
	);
</script>

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
