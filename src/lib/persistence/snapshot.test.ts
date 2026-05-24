import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/db/client';
import { RepoErrorCode } from '$lib/kit/repoErrors';
import { createClass } from '$lib/repos/classes.repo';
import { createLesson } from '$lib/repos/lessons.repo';
import { PLANNER_FILE_VERSION } from './plannerFile';
import { loadClassSnapshot } from './snapshot';

describe('loadClassSnapshot', () => {
	beforeEach(async () => {
		await db.delete();
		await db.open();
	});

	it('returns class slice with version and related rows', async () => {
		const classRow = await createClass({ name: 'Math', totalHoursTarget: 40 });
		const lesson = await createLesson({
			classId: classRow.id,
			date: '2026-05-01',
			durationHours: 1,
			title: 'Intro'
		});

		const snapshot = await loadClassSnapshot(classRow.id);

		expect(snapshot).toEqual({
			version: PLANNER_FILE_VERSION,
			class: classRow,
			students: [],
			lessons: [lesson],
			absences: []
		});
	});

	it('throws CLASS_NOT_FOUND when class is missing', async () => {
		await expect(loadClassSnapshot('missing')).rejects.toThrow(RepoErrorCode.CLASS_NOT_FOUND);
	});
});
