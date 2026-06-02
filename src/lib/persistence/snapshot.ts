import { db } from '$lib/db/client';
import type { ClassId } from '$lib/db/types';
import { RepoErrorCode, repoError } from '$lib/kit/repoErrors';
import type { PlannerFileV1 } from '$lib/schemas/plannerFile';
import { PLANNER_FILE_VERSION } from './plannerFile';

export async function loadClassSnapshot(classId: ClassId): Promise<PlannerFileV1> {
	const classRow = await db.classes.get(classId);
	if (!classRow) throw repoError(RepoErrorCode.CLASS_NOT_FOUND);
	const students = await db.students.where('classId').equals(classId).toArray();
	const lessons = await db.lessons.where('classId').equals(classId).toArray();
	const lessonIds = lessons.map((l) => l.id);
	const absences =
		lessonIds.length === 0
			? []
			: await db.absences.where('lessonId').anyOf(lessonIds).toArray();
	return {
		version: PLANNER_FILE_VERSION,
		class: classRow,
		students,
		lessons: lessons.map(({ done: _, ...lesson }) => lesson),
		absences
	};
}
