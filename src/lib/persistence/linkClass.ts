import { loadClassSnapshot } from './snapshot';
import { writePlannerFile, ensureReadWritePermission } from './classFolder';
import { putFolderHandle } from './meta';
import type { ClassId } from '$lib/db/types';

export async function pickClassFolder(): Promise<FileSystemDirectoryHandle | null> {
	if (!('showDirectoryPicker' in window)) return null;
	try {
		return await (
			window as Window & { showDirectoryPicker(): Promise<FileSystemDirectoryHandle> }
		).showDirectoryPicker();
	} catch {
		return null; // user cancelled
	}
}

export async function linkClassToPickedFolder(classId: ClassId, handle: FileSystemDirectoryHandle): Promise<boolean> {
	if (!(await ensureReadWritePermission(handle))) return false;
	const snapshot = await loadClassSnapshot(classId);
	await writePlannerFile(handle, snapshot);
	await putFolderHandle(classId, handle);
	return true;
}
