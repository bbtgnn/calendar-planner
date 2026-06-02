import { describe, expect, it } from 'vitest';
import { legacyBackupSchema } from './legacyBackup';
import { plannerFileSchema } from './plannerFile';

const classRow = {
	id: 'c1',
	name: 'Math',
	totalHoursTarget: 40,
	requiredStudentLessonHours: 0,
	createdAt: 1710000000000,
	semesterStart: null,
	semesterEnd: null
};

const studentRow = { id: 's1', classId: 'c1', name: 'Alice' };
const persistedLessonRow = {
	id: 'l1',
	classId: 'c1',
	date: '2026-01-01',
	durationHours: 1,
	title: 'Intro',
	sessionKind: 'class' as const
};
const lessonRow = { ...persistedLessonRow, done: false };
const absenceRow = { id: 'a1', lessonId: 'l1', studentId: 's1' };

describe('plannerFileSchema', () => {
	it('accepts a valid single-class file', () => {
		const result = plannerFileSchema.safeParse({
			version: 1,
			class: classRow,
			students: [studentRow],
			lessons: [persistedLessonRow],
			absences: [absenceRow]
		});
		expect(result.success).toBe(true);
	});

	it('strips done from lessons on parse', () => {
		const result = plannerFileSchema.safeParse({
			version: 1,
			class: classRow,
			students: [],
			lessons: [{ ...persistedLessonRow, done: true }],
			absences: []
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.lessons[0]).toEqual(persistedLessonRow);
		}
	});

	it('rejects wrong version', () => {
		const result = plannerFileSchema.safeParse({
			version: 2,
			class: classRow,
			students: [],
			lessons: [],
			absences: []
		});
		expect(result.success).toBe(false);
	});

	it('rejects student classId mismatch', () => {
		const result = plannerFileSchema.safeParse({
			version: 1,
			class: classRow,
			students: [{ ...studentRow, classId: 'other' }],
			lessons: [],
			absences: []
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.message === 'student classId mismatch')).toBe(true);
		}
	});

	it('rejects lesson classId mismatch', () => {
		const result = plannerFileSchema.safeParse({
			version: 1,
			class: classRow,
			students: [],
			lessons: [{ ...persistedLessonRow, classId: 'other' }],
			absences: []
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.message === 'lesson classId mismatch')).toBe(true);
		}
	});

	it('rejects invalid absence reference', () => {
		const result = plannerFileSchema.safeParse({
			version: 1,
			class: classRow,
			students: [studentRow],
			lessons: [persistedLessonRow],
			absences: [{ id: 'a1', lessonId: 'missing', studentId: 's1' }]
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.message === 'invalid absence reference')).toBe(true);
		}
	});

	it('defaults sessionKind to class', () => {
		const { sessionKind: _, ...lessonWithoutKind } = persistedLessonRow;
		const result = plannerFileSchema.safeParse({
			version: 1,
			class: classRow,
			students: [],
			lessons: [lessonWithoutKind],
			absences: []
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.lessons[0].sessionKind).toBe('class');
		}
	});
});

describe('legacyBackupSchema', () => {
	it('accepts a valid backup', () => {
		const result = legacyBackupSchema.safeParse({
			classes: [classRow],
			students: [studentRow],
			lessons: [lessonRow],
			absences: [absenceRow]
		});
		expect(result.success).toBe(true);
	});

	it('rejects student with unknown classId', () => {
		const result = legacyBackupSchema.safeParse({
			classes: [classRow],
			students: [{ ...studentRow, classId: 'missing' }],
			lessons: [],
			absences: []
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.message === 'invalid classId reference')).toBe(
				true
			);
		}
	});

	it('rejects lesson with unknown classId', () => {
		const result = legacyBackupSchema.safeParse({
			classes: [classRow],
			students: [],
			lessons: [{ ...lessonRow, classId: 'missing' }],
			absences: []
		});
		expect(result.success).toBe(false);
	});

	it('rejects absence with invalid references', () => {
		const result = legacyBackupSchema.safeParse({
			classes: [classRow],
			students: [studentRow],
			lessons: [lessonRow],
			absences: [{ id: 'a1', lessonId: 'missing', studentId: 's1' }]
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.message === 'invalid absence reference')).toBe(
				true
			);
		}
	});

	it('rejects missing top-level arrays', () => {
		const result = legacyBackupSchema.safeParse({ classes: [] });
		expect(result.success).toBe(false);
	});
});
