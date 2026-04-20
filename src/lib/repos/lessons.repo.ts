import { db } from '$lib/db/client';
import type { ClassId, LessonId, LessonRow } from '$lib/db/types';

export async function listLessons(classId: ClassId): Promise<LessonRow[]> {
	const rows = await db.lessons.where('classId').equals(classId).toArray();
	rows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
	return rows;
}

export async function getLesson(id: LessonId): Promise<LessonRow | undefined> {
	return db.lessons.get(id);
}

export async function createLesson(input: {
	classId: ClassId;
	date: string;
	durationHours: number;
	title: string;
}): Promise<LessonRow> {
	const row: LessonRow = {
		id: crypto.randomUUID(),
		classId: input.classId,
		date: input.date,
		durationHours: input.durationHours,
		title: input.title || 'Lesson',
		done: false
	};
	await db.lessons.add(row);
	return row;
}

export async function updateLesson(
	id: LessonId,
	patch: Partial<Pick<LessonRow, 'date' | 'durationHours' | 'title' | 'done'>>
): Promise<void> {
	await db.lessons.update(id, patch);
}

export async function deleteLessonCascade(id: LessonId): Promise<void> {
	await db.transaction('rw', db.lessons, db.absences, async () => {
		await db.absences.where('lessonId').equals(id).delete();
		await db.lessons.delete(id);
	});
}
