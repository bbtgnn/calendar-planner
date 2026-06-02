import { describe, expect, it } from 'vitest';
import type { PlannerFileV1 } from '$lib/schemas/plannerFile';
import {
	PLANNER_FILE_NAME,
	PLANNER_FILE_VERSION,
	parseLegacyBackup,
	parsePlannerFile,
	serializePlannerFile
} from './plannerFile';

const persistedLesson = {
	id: 'l1',
	classId: 'c1',
	date: '2026-01-01',
	durationHours: 1,
	title: 'Intro',
	sessionKind: 'class' as const
};

const validPlanner = {
	version: 1 as const,
	class: {
		id: 'c1',
		name: 'Math',
		totalHoursTarget: 40,
		requiredStudentLessonHours: 0,
		createdAt: 1710000000000,
		semesterStart: null,
		semesterEnd: null
	},
	students: [{ id: 's1', classId: 'c1', name: 'Alice' }],
	lessons: [persistedLesson],
	absences: [{ id: 'a1', lessonId: 'l1', studentId: 's1' }]
} satisfies PlannerFileV1;

describe('planner file persistence', () => {
	it('exports constants', () => {
		expect(PLANNER_FILE_VERSION).toBe(1);
		expect(PLANNER_FILE_NAME).toBe('planner.json');
	});

	it('parsePlannerFile accepts valid data', () => {
		const result = parsePlannerFile(validPlanner);
		expect(result).toEqual({ ok: true, value: validPlanner });
	});

	it('parsePlannerFile strips stored done and enrich fields from legacy files', () => {
		const result = parsePlannerFile({
			...validPlanner,
			lessons: [
				{
					...persistedLesson,
					done: true,
					criteria: [{ id: 'note', satisfied: true }],
					matchedNote: { folder: 'lezioni', fileName: '09.md' },
					screenshotRef: { folder: 'lezioni', fileName: '09-screen.png' }
				}
			]
		});
		expect(result).toEqual({ ok: true, value: validPlanner });
	});

	it('parsePlannerFile rejects invalid data with standard message', () => {
		const result = parsePlannerFile({ version: 2 });
		expect(result).toEqual({
			ok: false,
			message: 'Could not load planner.json — file may be damaged.'
		});
	});

	it('serializePlannerFile round-trips', () => {
		const json = serializePlannerFile(validPlanner);
		expect(JSON.parse(json)).toEqual(validPlanner);
		const reparsed = parsePlannerFile(JSON.parse(json));
		expect(reparsed).toEqual({ ok: true, value: validPlanner });
	});

	it('serializePlannerFile strips derived lesson fields', () => {
		const json = serializePlannerFile({
			...validPlanner,
			lessons: [
				{
					...persistedLesson,
					done: true,
					criteria: [{ id: 'note', satisfied: true }],
					matchedNote: { folder: 'lezioni', fileName: '09.md' },
					screenshotRef: { folder: 'lezioni', fileName: '09-screen.png' },
					hoursWarning: {
						plannerHours: 2,
						noteHours: 1.5,
						fileName: '09.md',
						folder: 'lezioni'
					}
				}
			]
		} as unknown as PlannerFileV1);
		expect(JSON.parse(json).lessons[0]).toEqual(persistedLesson);
	});
});

describe('parseLegacyBackup', () => {
	it('accepts valid backup', () => {
		const result = parseLegacyBackup({
			classes: [validPlanner.class],
			students: validPlanner.students,
			lessons: [{ ...persistedLesson, done: false }],
			absences: validPlanner.absences
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.classes).toHaveLength(1);
		}
	});

	it('rejects invalid structure', () => {
		const result = parseLegacyBackup({ classes: [] });
		expect(result).toEqual({
			ok: false,
			message: 'Not a valid backup file — expected classes, students, lessons, and absences.'
		});
	});

	it('rejects invalid FK references', () => {
		const result = parseLegacyBackup({
			classes: [validPlanner.class],
			students: [{ id: 's1', classId: 'missing', name: 'Alice' }],
			lessons: [],
			absences: []
		});
		expect(result).toEqual({
			ok: false,
			message: 'Backup has invalid references — restore cancelled.'
		});
	});
});
