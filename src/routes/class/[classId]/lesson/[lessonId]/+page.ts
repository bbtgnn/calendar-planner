import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { classStudentsLoadKey, lessonLoadKey } from '$lib/kit/loadKeys';
import { enrichClassLessonsFromFolder } from '$lib/lessonNotes/enrich';
import { listAbsentStudentIds } from '$lib/repos/attendance.repo';
import { getLesson } from '$lib/repos/lessons.repo';
import { listStudents } from '$lib/repos/students.repo';
import { lessonFormUi } from '$lib/logic/sessionKind';

export const load: PageLoad = async ({ params, depends }) => {
	depends(lessonLoadKey(params.lessonId));
	const raw = await getLesson(params.lessonId);
	if (!raw || raw.classId !== params.classId) throw error(404, 'Lesson not found');
	const { lessons } = await enrichClassLessonsFromFolder(params.classId, [raw]);
	const lesson = lessons[0];
	depends(classStudentsLoadKey(lesson.classId));
	const students = await listStudents(lesson.classId);
	const absentIds = lessonFormUi(lesson.sessionKind).attendanceVisible
		? await listAbsentStudentIds(lesson.id)
		: [];
	return { lesson, students, absentIds };
};
