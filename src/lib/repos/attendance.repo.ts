import { db } from '$lib/db/client';
import type { LessonId, StudentId } from '$lib/db/types';

function absenceId(lessonId: LessonId, studentId: StudentId): string {
	return `${lessonId}__${studentId}`;
}

export async function listAbsentStudentIds(lessonId: LessonId): Promise<StudentId[]> {
	const rows = await db.absences.where('lessonId').equals(lessonId).toArray();
	return rows.map((r) => r.studentId);
}

export async function setAbsent(lessonId: LessonId, studentId: StudentId, absent: boolean): Promise<void> {
	const id = absenceId(lessonId, studentId);
	if (absent) {
		await db.absences.put({ id, lessonId, studentId });
	} else {
		await db.absences.delete(id);
	}
}
