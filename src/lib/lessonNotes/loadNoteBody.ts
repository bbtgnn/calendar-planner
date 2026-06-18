import type { ClassId } from '$lib/db/types';
import { hasFolderPermission } from '$lib/persistence/classFolder';
import { getFolderHandle } from '$lib/persistence/meta';
import { stripNoteBody } from './parseFrontmatter';
import type { MatchedNoteRef } from './types';

export async function loadNoteBody(
	classId: ClassId,
	ref: MatchedNoteRef
): Promise<{ ok: true; body: string } | { ok: false; message: string }> {
	const root = await getFolderHandle(classId);
	if (!root || !(await hasFolderPermission(root, 'read'))) {
		return { ok: false, message: 'Folder not available' };
	}
	try {
		const sub = await root.getDirectoryHandle(ref.folder);
		const fileHandle = await sub.getFileHandle(ref.fileName);
		const file = await fileHandle.getFile();
		const text = await file.text();
		return { ok: true, body: stripNoteBody(text) };
	} catch {
		return { ok: false, message: 'Could not load note' };
	}
}
