import { db } from '$lib/db/client';
import type { ClassId, LessonId, LessonRow, LessonSessionKind } from '$lib/db/types';

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
	sessionKind?: LessonSessionKind;
}): Promise<LessonRow> {
	const sessionKind = input.sessionKind ?? 'class';
	const row: LessonRow = {
		id: crypto.randomUUID(),
		classId: input.classId,
		date: input.date,
		durationHours: sessionKind === 'skipped' ? 0 : input.durationHours,
		title: input.title || 'Lesson',
		done: false,
		sessionKind
	};
	await db.lessons.add(row);
	return row;
}

export async function updateLesson(
	id: LessonId,
	patch: Partial<Pick<LessonRow, 'date' | 'durationHours' | 'title' | 'done' | 'sessionKind'>>
): Promise<void> {
	await db.transaction('rw', db.lessons, db.absences, async () => {
		const current = await db.lessons.get(id);
		if (!current) return;

		if (patch.sessionKind === 'extra' && current.sessionKind !== 'extra') {
			const n = await db.absences.where('lessonId').equals(id).count();
			if (n > 0) {
				throw new Error('SESSION_KIND_EXTRA_BLOCKED_ABSENCES');
			}
		}

		const nextKind = patch.sessionKind ?? current.sessionKind;
		const nextPatch: Partial<
			Pick<LessonRow, 'date' | 'durationHours' | 'title' | 'done' | 'sessionKind'>
		> = {
			...patch
		};

		if (nextKind === 'skipped') {
			nextPatch.durationHours = 0;
		}

		if (patch.sessionKind === 'skipped' && current.sessionKind !== 'skipped') {
			await db.absences.where('lessonId').equals(id).delete();
		}

		await db.lessons.update(id, nextPatch);
	});
}

export async function deleteLessonCascade(id: LessonId): Promise<void> {
	await db.transaction('rw', db.lessons, db.absences, async () => {
		await db.absences.where('lessonId').equals(id).delete();
		await db.lessons.delete(id);
	});
}
