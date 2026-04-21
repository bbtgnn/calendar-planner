import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/db/client';
import { createClass, deleteClassCascade, updateClass } from './classes.repo';

beforeEach(async () => {
	await db.delete();
	await db.open();
});

describe('classes.repo', () => {
	it('deleteClassCascade removes students lessons absences', async () => {
		const c = await createClass({ name: 'A', totalHoursTarget: 10 });
		const sid = crypto.randomUUID();
		await db.students.add({ id: sid, classId: c.id, name: 'S' });
		const lid = crypto.randomUUID();
		await db.lessons.add({
			id: lid,
			classId: c.id,
			date: '2026-04-01',
			durationHours: 2,
			title: 'L',
			done: false,
			sessionKind: 'class'
		});
		await db.absences.add({ id: `${lid}__${sid}`, lessonId: lid, studentId: sid });

		await deleteClassCascade(c.id);

		expect(await db.classes.count()).toBe(0);
		expect(await db.students.count()).toBe(0);
		expect(await db.lessons.count()).toBe(0);
		expect(await db.absences.count()).toBe(0);
	});

	it('createClass defaults semester fields to null', async () => {
		const c = await createClass({ name: 'S', totalHoursTarget: 1 });
		expect(c.semesterStart).toBeNull();
		expect(c.semesterEnd).toBeNull();
	});

	it('updateClass rejects semester with only start set', async () => {
		const c = await createClass({ name: 'S', totalHoursTarget: 1 });
		await expect(updateClass(c.id, { semesterStart: '2026-04-01' })).rejects.toThrow(/both/);
	});

	it('updateClass rejects start after end', async () => {
		const c = await createClass({ name: 'S', totalHoursTarget: 1 });
		await expect(
			updateClass(c.id, { semesterStart: '2026-05-01', semesterEnd: '2026-04-01' })
		).rejects.toThrow(/before/);
	});

	it('updateClass accepts cleared pair and valid pair', async () => {
		const c = await createClass({ name: 'S', totalHoursTarget: 1 });
		await updateClass(c.id, { semesterStart: '2026-04-01', semesterEnd: '2026-04-30' });
		let row = await db.classes.get(c.id);
		expect(row?.semesterStart).toBe('2026-04-01');
		await updateClass(c.id, { semesterStart: null, semesterEnd: null });
		row = await db.classes.get(c.id);
		expect(row?.semesterStart).toBeNull();
		expect(row?.semesterEnd).toBeNull();
	});
});
