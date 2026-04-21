import { db } from '$lib/db/client';
import { assertValidSemesterBounds, mergeSemesterFields } from '$lib/logic/semesterCalendar';
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
	requiredStudentLessonHours?: number;
}): Promise<ClassRow> {
	const row: ClassRow = {
		id: crypto.randomUUID(),
		name: input.name,
		totalHoursTarget: input.totalHoursTarget,
		requiredStudentLessonHours: input.requiredStudentLessonHours ?? 0,
		createdAt: Date.now(),
		semesterStart: null,
		semesterEnd: null
	};
	await db.classes.add(row);
	return row;
}

export async function updateClass(
	id: ClassId,
	patch: Partial<
		Pick<ClassRow, 'name' | 'totalHoursTarget' | 'requiredStudentLessonHours' | 'semesterStart' | 'semesterEnd'>
	>
): Promise<void> {
	const existing = await getClass(id);
	if (!existing) throw new Error('Class not found.');
	const mergedSemester = mergeSemesterFields(
		{
			semesterStart: existing.semesterStart ?? null,
			semesterEnd: existing.semesterEnd ?? null
		},
		{
			semesterStart: patch.semesterStart,
			semesterEnd: patch.semesterEnd
		}
	);
	assertValidSemesterBounds(mergedSemester.semesterStart, mergedSemester.semesterEnd);
	await db.classes.update(id, patch);
}

export async function deleteClassCascade(id: ClassId): Promise<void> {
	await db.transaction('rw', db.classes, db.students, db.lessons, db.absences, async () => {
		const lessonIds = (await db.lessons.where('classId').equals(id).primaryKeys()) as string[];
		const studentIds = (await db.students.where('classId').equals(id).primaryKeys()) as string[];
		if (lessonIds.length > 0) {
			await db.absences.where('lessonId').anyOf(lessonIds).delete();
		}
		if (studentIds.length > 0) {
			await db.absences.where('studentId').anyOf(studentIds).delete();
		}
		await db.lessons.where('classId').equals(id).delete();
		await db.students.where('classId').equals(id).delete();
		await db.classes.delete(id);
	});
}
