import type { ClassId } from '$lib/db/types';
import { hasFolderPermission } from '$lib/persistence/classFolder';
import { getFolderHandle } from '$lib/persistence/meta';
import type { ScreenshotRef } from './types';

export async function loadScreenshotObjectUrl(
	classId: ClassId,
	ref: ScreenshotRef
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
	const root = await getFolderHandle(classId);
	if (!root || !(await hasFolderPermission(root, 'read'))) {
		return { ok: false, message: 'Folder not available' };
	}
	try {
		const sub = await root.getDirectoryHandle(ref.folder);
		const fileHandle = await sub.getFileHandle(ref.fileName);
		const file = await fileHandle.getFile();
		return { ok: true, url: URL.createObjectURL(file) };
	} catch {
		return { ok: false, message: 'Could not load screenshot' };
	}
}

export function revokeScreenshotObjectUrl(url: string | undefined): void {
	if (url) URL.revokeObjectURL(url);
}
