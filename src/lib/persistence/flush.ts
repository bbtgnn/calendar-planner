import type { ClassId } from '$lib/db/types';
import { setSaveStatus } from '$lib/ui/saveStatus.svelte';
import { showToast } from '$lib/ui/toast.svelte';
import { hasFolderPermission, writePlannerFile } from './classFolder';
import { getFolderHandle, touchFolderSynced } from './meta';
import { enrichClassLessonsFromFolder } from '$lib/lessonNotes/enrich';
import { loadClassSnapshot } from './snapshot';

const FLUSH_DEBOUNCE_MS = 400;

const flushTimers = new Map<ClassId, ReturnType<typeof setTimeout>>();

export function scheduleClassFlush(classId: ClassId): void {
	const existing = flushTimers.get(classId);
	if (existing) clearTimeout(existing);

	setSaveStatus('saving');
	flushTimers.set(
		classId,
		setTimeout(() => {
			flushTimers.delete(classId);
			void flushClassNow(classId);
		}, FLUSH_DEBOUNCE_MS)
	);
}

export function flushPendingClass(classId: ClassId): void {
	const existing = flushTimers.get(classId);
	if (!existing) return;
	clearTimeout(existing);
	flushTimers.delete(classId);
	void flushClassNow(classId);
}

export function flushAllPending(): void {
	for (const classId of flushTimers.keys()) {
		flushPendingClass(classId);
	}
}

export async function flushClassNow(classId: ClassId): Promise<void> {
	const handle = await getFolderHandle(classId);
	if (!handle) return;

	setSaveStatus('saving');
	try {
		if (!(await hasFolderPermission(handle, 'readwrite'))) {
			setSaveStatus('failed');
			showToast('Could not save to folder — try again.');
			return;
		}
		const snapshot = await loadClassSnapshot(classId);
		const enriched = await enrichClassLessonsFromFolder(classId, snapshot.lessons);
		if (enriched.notesScanned) {
			snapshot.lessons = enriched.lessons;
		}
		await writePlannerFile(handle, snapshot);
		await touchFolderSynced(classId);
		setSaveStatus('saved');
	} catch {
		setSaveStatus('failed');
		showToast('Could not save to folder — try again.');
	}
}
