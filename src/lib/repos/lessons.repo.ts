import { db } from '$lib/db/client';
import type { ClassId, LessonId, LessonRow, LessonSessionKind } from '$lib/db/types';
import { planLessonWrite, type LessonFieldPatch } from '$lib/logic/sessionKind';

export async function listLessons(classId: ClassId): Promise<LessonRow[]> {
	const rows = await db.lessons.where('classId').equals(classId).toArray();
	rows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
	return rows;
}

export async function listLessonsForClassIds(
	classIds: ClassId[]
): Promise<Record<ClassId, LessonRow[]>> {
	if (classIds.length === 0) return {};
	const rows = await db.lessons.where('classId').anyOf(classIds).toArray();
	rows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
	const out: Record<ClassId, LessonRow[]> = {};
	for (const id of classIds) out[id] = [];
	for (const row of rows) {
		(out[row.classId] ??= []).push(row);
	}
	return out;
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
	const { patch } = planLessonWrite({
		current: { sessionKind, durationHours: input.durationHours, done: false },
		patch: {
			sessionKind,
			durationHours: input.durationHours,
			title: input.title || 'Lesson'
		},
		absenceCount: 0
	});
	const row: LessonRow = {
		id: crypto.randomUUID(),
		classId: input.classId,
		date: input.date,
		durationHours: patch.durationHours ?? input.durationHours,
		title: (patch.title ?? input.title) || 'Lesson',
		done: false,
		sessionKind: patch.sessionKind ?? sessionKind
	};
	await db.lessons.add(row);
	return row;
}

export async function updateLesson(id: LessonId, patch: LessonFieldPatch): Promise<void> {
	await db.transaction('rw', db.lessons, db.absences, async () => {
		const current = await db.lessons.get(id);
		if (!current) return;

		let absenceCount = 0;
		if (patch.sessionKind === 'extra' && current.sessionKind !== 'extra') {
			absenceCount = await db.absences.where('lessonId').equals(id).count();
		}

		const plan = planLessonWrite({
			current: {
				sessionKind: current.sessionKind,
				durationHours: current.durationHours,
				done: current.done
			},
			patch,
			absenceCount
		});

		if (plan.clearAbsences) {
			await db.absences.where('lessonId').equals(id).delete();
		}

		await db.lessons.update(id, plan.patch);
	});
}

export async function deleteLessonCascade(id: LessonId): Promise<void> {
	await db.transaction('rw', db.lessons, db.absences, async () => {
		await db.absences.where('lessonId').equals(id).delete();
		await db.lessons.delete(id);
	});
}
