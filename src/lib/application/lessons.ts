import * as lessonsRepo from '$lib/repos/lessons.repo';
import { notifyClassDirty } from '$lib/persistence/notify';
import type { ClassId, LessonId, LessonRow } from '$lib/db/types';
import type { LessonFieldPatch } from '$lib/logic/sessionKind';

export async function createLesson(
	input: Parameters<typeof lessonsRepo.createLesson>[0]
): Promise<LessonRow> {
	const row = await lessonsRepo.createLesson(input);
	notifyClassDirty(input.classId);
	return row;
}

export async function updateLesson(id: LessonId, patch: LessonFieldPatch): Promise<void> {
	const lesson = await lessonsRepo.getLesson(id);
	await lessonsRepo.updateLesson(id, patch);
	if (lesson) notifyClassDirty(lesson.classId);
}

export async function deleteLessonCascade(id: LessonId): Promise<void> {
	const lesson = await lessonsRepo.getLesson(id);
	await lessonsRepo.deleteLessonCascade(id);
	if (lesson) notifyClassDirty(lesson.classId);
}
