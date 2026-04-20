import { db } from '$lib/db/client';
import type { ClassId, ClassRow } from '$lib/db/types';

export async function listClasses(): Promise<ClassRow[]> {
	return db.classes.orderBy('createdAt').toArray();
}

export async function getClass(id: ClassId): Promise<ClassRow | undefined> {
	return db.classes.get(id);
}

export async function createClass(input: {
	name: string;
	totalHoursTarget: number;
}): Promise<ClassRow> {
	const row: ClassRow = {
		id: crypto.randomUUID(),
		name: input.name,
		totalHoursTarget: input.totalHoursTarget,
		createdAt: Date.now()
	};
	await db.classes.add(row);
	return row;
}

export async function updateClass(
	id: ClassId,
	patch: Partial<Pick<ClassRow, 'name' | 'totalHoursTarget'>>
): Promise<void> {
	await db.classes.update(id, patch);
}

export async function deleteClassCascade(id: ClassId): Promise<void> {
	const studentIds = await db.students.where('classId').equals(id).primaryKeys();
	const lessonIds = await db.lessons.where('classId').equals(id).primaryKeys();

	await db.transaction('rw', db.classes, db.students, db.lessons, db.absences, async () => {
		for (const lessonId of lessonIds) {
			await db.absences.where('lessonId').equals(lessonId).delete();
		}
		for (const studentId of studentIds) {
			await db.absences.where('studentId').equals(studentId).delete();
		}
		await db.lessons.where('classId').equals(id).delete();
		await db.students.where('classId').equals(id).delete();
		await db.classes.delete(id);
	});
}
