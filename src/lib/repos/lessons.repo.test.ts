import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/db/client';
import { createClass } from './classes.repo';
import { createLesson, updateLesson } from './lessons.repo';

beforeEach(async () => {
	await db.delete();
	await db.open();
});

describe('lessons.repo', () => {
	it('updateLesson throws when switching class to extra if absences exist', async () => {
		const c = await createClass({ name: 'A', totalHoursTarget: 10 });
		const lesson = await createLesson({
			classId: c.id,
			date: '2026-05-01',
			durationHours: 1,
			title: 'L'
		});
		const sid = crypto.randomUUID();
		await db.students.add({ id: sid, classId: c.id, name: 'S' });
		await db.absences.add({ id: `${lesson.id}__${sid}`, lessonId: lesson.id, studentId: sid });

		await expect(updateLesson(lesson.id, { sessionKind: 'extra' })).rejects.toThrow(
			'SESSION_KIND_EXTRA_BLOCKED_ABSENCES'
		);
	});

	it('updateLesson allows class to extra when there are no absences', async () => {
		const c = await createClass({ name: 'A', totalHoursTarget: 10 });
		const lesson = await createLesson({
			classId: c.id,
			date: '2026-05-01',
			durationHours: 1,
			title: 'L'
		});
		await updateLesson(lesson.id, { sessionKind: 'extra' });
		const row = await db.lessons.get(lesson.id);
		expect(row?.sessionKind).toBe('extra');
	});

	it('updateLesson still applies when already extra even if absence rows exist', async () => {
		const c = await createClass({ name: 'A', totalHoursTarget: 10 });
		const lesson = await createLesson({
			classId: c.id,
			date: '2026-05-01',
			durationHours: 1,
			title: 'L',
			sessionKind: 'extra'
		});
		const sid = crypto.randomUUID();
		await db.students.add({ id: sid, classId: c.id, name: 'S' });
		await db.absences.add({ id: `${lesson.id}__${sid}`, lessonId: lesson.id, studentId: sid });

		await updateLesson(lesson.id, { sessionKind: 'extra', title: 'Updated' });
		const row = await db.lessons.get(lesson.id);
		expect(row?.title).toBe('Updated');
	});
});
