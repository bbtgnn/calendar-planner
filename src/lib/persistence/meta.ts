import { db } from '$lib/db/client';
import type { ClassFolderMetaRow, ClassId } from '$lib/db/types';

export async function listFolderClassIds(): Promise<ClassId[]> {
	return db.classFolders.toCollection().primaryKeys();
}

export async function getFolderHandle(classId: ClassId): Promise<FileSystemDirectoryHandle | undefined> {
	const row = await db.classFolders.get(classId);
	return row?.directoryHandle;
}

export async function putFolderHandle(
	classId: ClassId,
	directoryHandle: FileSystemDirectoryHandle
): Promise<void> {
	const row: ClassFolderMetaRow = {
		classId,
		directoryHandle,
		linkedAt: Date.now()
	};
	await db.classFolders.put(row);
}

export async function touchFolderSynced(classId: ClassId): Promise<void> {
	await db.classFolders.update(classId, { lastSyncedAt: Date.now() });
}

export async function removeFolderHandle(classId: ClassId): Promise<void> {
	await db.classFolders.delete(classId);
}
