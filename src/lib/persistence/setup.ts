import { listClasses } from '$lib/repos/classes.repo';
import { listFolderClassIds } from './meta';
import { isFileStorageSupported } from './classFolder';
import type { ClassId } from '$lib/db/types';

export { isFileStorageSupported };

export async function getUnlinkedClassIds(): Promise<ClassId[]> {
	const classes = await listClasses();
	const linked = new Set(await listFolderClassIds());
	return classes.filter((c) => !linked.has(c.id)).map((c) => c.id);
}

export async function needsSetup(): Promise<boolean> {
	if (!isFileStorageSupported()) return false;
	const classes = await listClasses();
	if (classes.length === 0) return false;
	return (await getUnlinkedClassIds()).length > 0;
}
