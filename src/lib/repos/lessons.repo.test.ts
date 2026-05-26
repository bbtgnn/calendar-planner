import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/db/client';
import { createClass } from './classes.repo';
import { createLesson, listLessonsForClassIds, updateLesson } from './lessons.repo';

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

	it('createLesson stores 0 hours for skipped sessions', async () => {
		const c = await createClass({ name: 'A', totalHoursTarget: 10 });
		const lesson = await createLesson({
			classId: c.id,
			date: '2026-05-02',
			durationHours: 2,
			title: 'Holiday',
			sessionKind: 'skipped'
		});
		expect(lesson.sessionKind).toBe('skipped');
		expect(lesson.durationHours).toBe(0);
		const row = await db.lessons.get(lesson.id);
		expect(row?.durationHours).toBe(0);
	});

	it('updateLesson to skipped coerces hours to 0 and clears absences atomically', async () => {
		const c = await createClass({ name: 'A', totalHoursTarget: 10 });
		const lesson = await createLesson({
			classId: c.id,
			date: '2026-05-03',
			durationHours: 1.5,
			title: 'L1'
		});
		const sid = crypto.randomUUID();
		await db.students.add({ id: sid, classId: c.id, name: 'S' });
		await db.absences.add({ id: `${lesson.id}__${sid}`, lessonId: lesson.id, studentId: sid });

		await updateLesson(lesson.id, { sessionKind: 'skipped' });
		const row = await db.lessons.get(lesson.id);
		expect(row?.sessionKind).toBe('skipped');
		expect(row?.durationHours).toBe(0);
		const absenceCount = await db.absences.where('lessonId').equals(lesson.id).count();
		expect(absenceCount).toBe(0);
	});

	it('listLessonsForClassIds returns lessons grouped by classId', async () => {
		const c1 = await createClass({ name: 'One', totalHoursTarget: 10 });
		const c2 = await createClass({ name: 'Two', totalHoursTarget: 10 });
		await createLesson({ classId: c1.id, date: '2026-04-01', durationHours: 2, title: 'A' });
		await createLesson({ classId: c2.id, date: '2026-04-02', durationHours: 2, title: 'B' });
		const map = await listLessonsForClassIds([c1.id, c2.id]);
		expect(map[c1.id]).toHaveLength(1);
		expect(map[c2.id]).toHaveLength(1);
		expect(map[c1.id]![0]!.date).toBe('2026-04-01');
	});

	it('listLessonsForClassIds returns empty object for empty ids', async () => {
		expect(await listLessonsForClassIds([])).toEqual({});
	});

	it('updateLesson keeps skipped duration at 0 even if duration patch is provided', async () => {
		const c = await createClass({ name: 'A', totalHoursTarget: 10 });
		const lesson = await createLesson({
			classId: c.id,
			date: '2026-05-04',
			durationHours: 1,
			title: 'Skip me',
			sessionKind: 'skipped'
		});
		await updateLesson(lesson.id, { durationHours: 4 });
		const row = await db.lessons.get(lesson.id);
		expect(row?.durationHours).toBe(0);
	});
});
