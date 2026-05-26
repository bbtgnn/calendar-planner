import { db } from '$lib/db/client';
import type { ClassId } from '$lib/db/types';
import type { PlannerFileV1 } from '$lib/schemas/plannerFile';
import { hasFolderPermission, readPlannerFile } from './classFolder';
import { getFolderHandle, listFolderClassIds } from './meta';

export type HydrateClassError = { classId: ClassId; message: string };
export type HydrateResult = { ok: true } | { ok: false; errors: HydrateClassError[] };

let hydratedThisSession = false;

export async function hydrateClassFromFile(classId: ClassId, file: PlannerFileV1): Promise<void> {
	if (file.class.id !== classId) {
		throw new Error('Planner file class id does not match');
	}
	await db.transaction('rw', db.classes, db.students, db.lessons, db.absences, async () => {
		const lessonIds = (await db.lessons.where('classId').equals(classId).primaryKeys()) as string[];
		if (lessonIds.length > 0) {
			await db.absences.where('lessonId').anyOf(lessonIds).delete();
		}
		await db.lessons.where('classId').equals(classId).delete();
		await db.students.where('classId').equals(classId).delete();
		await db.classes.delete(classId);

		await db.classes.add(file.class);
		if (file.students.length) await db.students.bulkAdd(file.students);
		if (file.lessons.length) await db.lessons.bulkAdd(file.lessons);
		if (file.absences.length) await db.absences.bulkAdd(file.absences);
	});
}

export async function hydrateAllLinkedClassesFromFiles(): Promise<HydrateResult> {
	if (hydratedThisSession) {
		return { ok: true };
	}
	hydratedThisSession = true;

	const errors: HydrateClassError[] = [];
	for (const classId of await listFolderClassIds()) {
		const handle = await getFolderHandle(classId);
		if (!handle) {
			errors.push({ classId, message: `Missing folder handle for class ${classId}` });
			continue;
		}
		if (!(await hasFolderPermission(handle, 'readwrite'))) {
			errors.push({
				classId,
				message: 'Could not access folder — reconnect to continue saving.'
			});
			continue;
		}
		const result = await readPlannerFile(handle);
		if (!result.ok) {
			errors.push({ classId, message: result.message });
			continue;
		}
		try {
			await hydrateClassFromFile(classId, result.value);
		} catch (err) {
			errors.push({
				classId,
				message: err instanceof Error ? err.message : 'Could not load class from file.'
			});
		}
	}

	return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
