import * as attendanceRepo from '$lib/repos/attendance.repo';
import * as lessonsRepo from '$lib/repos/lessons.repo';
import { notifyClassDirty } from '$lib/persistence/notify';
import type { LessonId, StudentId } from '$lib/db/types';

export async function setAbsent(
	lessonId: LessonId,
	studentId: StudentId,
	absent: boolean
): Promise<void> {
	await attendanceRepo.setAbsent(lessonId, studentId, absent);
	const lesson = await lessonsRepo.getLesson(lessonId);
	if (lesson) notifyClassDirty(lesson.classId);
}
