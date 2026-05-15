import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { classStudentsLoadKey, lessonLoadKey } from '$lib/kit/loadKeys';
import { getLesson } from '$lib/repos/lessons.repo';
import { listStudents } from '$lib/repos/students.repo';
import { listAbsentStudentIds } from '$lib/repos/attendance.repo';
import { lessonFormUi } from '$lib/logic/sessionKind';

export const load: PageLoad = async ({ params, depends }) => {
	depends(lessonLoadKey(params.lessonId));
	const lesson = await getLesson(params.lessonId);
	if (!lesson || lesson.classId !== params.classId) throw error(404, 'Lesson not found');
	depends(classStudentsLoadKey(lesson.classId));
	const students = await listStudents(lesson.classId);
	const absentIds = lessonFormUi(lesson.sessionKind).attendanceVisible
		? await listAbsentStudentIds(lesson.id)
		: [];
	return { lesson, students, absentIds };
};
