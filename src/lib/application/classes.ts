import * as classesRepo from '$lib/repos/classes.repo';
import { notifyClassDirty } from '$lib/persistence/notify';
import { removeFolderHandle } from '$lib/persistence/meta';
import { linkClassToPickedFolder, pickClassFolder } from '$lib/persistence/linkClass';
import type { ClassId, ClassRow } from '$lib/db/types';

export async function createClass(
	input: Parameters<typeof classesRepo.createClass>[0]
): Promise<ClassRow> {
	const row = await classesRepo.createClass(input);
	notifyClassDirty(row.id);
	return row;
}

export async function updateClass(
	id: ClassId,
	patch: Parameters<typeof classesRepo.updateClass>[1]
): Promise<void> {
	await classesRepo.updateClass(id, patch);
	notifyClassDirty(id);
}

export async function deleteClassCascade(id: ClassId): Promise<void> {
	await classesRepo.deleteClassCascade(id);
	await removeFolderHandle(id);
}

export async function createClassAndLinkFolder(
	input: Parameters<typeof classesRepo.createClass>[0]
): Promise<ClassRow> {
	const row = await createClass(input);
	const handle = await pickClassFolder();
	if (!handle) {
		await deleteClassCascade(row.id);
		throw new Error('Folder pick cancelled');
	}
	const linked = await linkClassToPickedFolder(row.id, handle);
	if (!linked) {
		await deleteClassCascade(row.id);
		throw new Error('Failed to link class folder');
	}
	return row;
}
