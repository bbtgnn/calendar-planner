<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import {
		listStudents,
		addStudent,
		updateStudent,
		deleteStudentCascade,
		appendStudents,
		replaceStudents
	} from '$lib/repos/students.repo';
	import { parseCsvNames, parseTxtNames } from '$lib/logic/rosterImport';
	import { withRetry } from '$lib/db/withRetry';
	import { showToast } from '$lib/stores/toast';
	import type { StudentRow } from '$lib/db/types';

	let { data }: { data: PageData } = $props();

	let students = $state<StudentRow[]>([]);
	let newName = $state('');
	let editingId = $state<string | null>(null);
	let editValue = $state('');
	let previewNames = $state<string[]>([]);
	let previewSkipped = $state(0);
	let fileKind = $state<'csv' | 'txt' | null>(null);

	async function refresh() {
		students = await listStudents(data.class.id);
	}

	onMount(refresh);

	async function add() {
		if (!newName.trim()) return;
		try {
			await withRetry(() => addStudent(data.class.id, newName.trim()));
			newName = '';
			await refresh();
		} catch {
			showToast('Could not add student.');
		}
	}

	function startEdit(s: StudentRow) {
		editingId = s.id;
		editValue = s.name;
	}

	async function saveEdit() {
		const id = editingId;
		if (id == null) return;
		try {
			await withRetry(() => updateStudent(id, editValue.trim()));
			editingId = null;
			await refresh();
		} catch {
			showToast('Could not save student.');
		}
	}

	async function remove(id: string) {
		if (!window.confirm('Remove this student and their absence records?')) return;
		try {
			await withRetry(() => deleteStudentCascade(id));
			await refresh();
		} catch {
			showToast('Could not remove student.');
		}
	}

	function onFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		previewNames = [];
		previewSkipped = 0;
		fileKind = null;
		if (!file) return;
		const name = file.name.toLowerCase();
		fileKind = name.endsWith('.csv') ? 'csv' : 'txt';
		const reader = new FileReader();
		reader.onload = () => {
			const text = String(reader.result ?? '');
			const r = fileKind === 'csv' ? parseCsvNames(text) : parseTxtNames(text);
			previewNames = r.names;
			previewSkipped = r.skipped;
		};
		reader.readAsText(file);
		input.value = '';
	}

	async function doAppend() {
		if (previewNames.length === 0) return;
		try {
			await withRetry(() => appendStudents(data.class.id, previewNames));
			showToast(`Imported ${previewNames.length}, skipped ${previewSkipped}.`);
			previewNames = [];
			fileKind = null;
			await refresh();
		} catch {
			showToast('Could not import students.');
		}
	}

	async function doReplace() {
		if (previewNames.length === 0) return;
		if (
			!window.confirm(
				'Replace entire roster for this class? This removes current students and related absence rows.'
			)
		) {
			return;
		}
		try {
			await withRetry(() => replaceStudents(data.class.id, previewNames));
			showToast(`Replaced with ${previewNames.length}, skipped ${previewSkipped}.`);
			previewNames = [];
			fileKind = null;
			await refresh();
		} catch {
			showToast('Could not replace roster.');
		}
	}
</script>

<section class="card">
	<h1>Students — {data.class.name}</h1>
	{#if students.length === 0}
		<p class="muted">No students yet. Add names below or import a .txt / .csv file (first column = name; optional header <code>name</code>).</p>
	{:else}
		<ul class="list">
			{#each students as s (s.id)}
				<li>
					{#if editingId === s.id}
						<input class="grow" type="text" bind:value={editValue} />
						<button type="button" class="btn" onclick={saveEdit}>Save</button>
						<button type="button" class="btn" onclick={() => (editingId = null)}>Cancel</button>
					{:else}
						<span class="grow">{s.name}</span>
						<button type="button" class="btn" onclick={() => startEdit(s)}>Edit</button>
						<button type="button" class="btn danger" onclick={() => remove(s.id)}>Remove</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section class="card">
	<h2>Add student</h2>
	<div class="row">
		<label class="grow">
			Name
			<input type="text" bind:value={newName} placeholder="Full name" />
		</label>
		<button type="button" class="btn primary" onclick={add}>Add</button>
	</div>
</section>

<section class="card">
	<h2>Import</h2>
	<input type="file" accept=".txt,.csv" onchange={onFile} />
	{#if previewNames.length > 0}
		<p class="preview-meta">
			Preview: {previewNames.length} name(s), {previewSkipped} skipped line(s).
		</p>
		<ul class="preview">
			{#each previewNames.slice(0, 12) as n}
				<li>{n}</li>
			{/each}
			{#if previewNames.length > 12}
				<li>…</li>
			{/if}
		</ul>
		<div class="row">
			<button type="button" class="btn" onclick={doAppend}>Append</button>
			<button type="button" class="btn danger" onclick={doReplace}>Replace roster</button>
		</div>
	{/if}
</section>

<style>
	.card {
		background: #fff;
		padding: 1.25rem;
		border-radius: 8px;
		border: 1px solid #e2e5eb;
		margin-bottom: 1rem;
	}
	h1 {
		margin: 0 0 0.75rem;
		font-size: 1.25rem;
	}
	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.05rem;
	}
	.muted {
		color: #555;
	}
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.list li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0;
		border-bottom: 1px solid #eef0f3;
	}
	.grow {
		flex: 1;
		min-width: 8rem;
	}
	input[type='text'] {
		padding: 0.35rem 0.5rem;
		border: 1px solid #c9ced6;
		border-radius: 6px;
		width: 100%;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: flex-end;
	}
	.btn {
		padding: 0.4rem 0.75rem;
		border: 1px solid #c9ced6;
		background: #fff;
		border-radius: 6px;
		cursor: pointer;
	}
	.btn.primary {
		background: #1a56b8;
		color: #fff;
		border-color: #1a56b8;
	}
	.btn.danger {
		border-color: #e08585;
		color: #a32020;
	}
	.preview {
		max-height: 10rem;
		overflow: auto;
		background: #f6f7f9;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		font-size: 0.9rem;
	}
	.preview-meta {
		font-size: 0.9rem;
		color: #444;
	}
</style>
