import { z } from 'zod';

export const lessonSessionKindSchema = z.enum(['class', 'extra', 'skipped']);

export const classRowSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	totalHoursTarget: z.number().finite(),
	requiredStudentLessonHours: z.number().finite().default(0),
	createdAt: z.number().finite(),
	semesterStart: z.string().nullable().default(null),
	semesterEnd: z.string().nullable().default(null)
});

export const studentRowSchema = z.object({
	id: z.string().min(1),
	classId: z.string().min(1),
	name: z.string().min(1)
});

export const lessonRowSchema = z.object({
	id: z.string().min(1),
	classId: z.string().min(1),
	date: z.string().min(1),
	durationHours: z.number().finite(),
	title: z.string().min(1),
	done: z.boolean(),
	sessionKind: lessonSessionKindSchema.default('class')
});

/** On-disk planner.json lessons — `done` is derived at runtime from folder scan. */
export const persistedLessonRowSchema = lessonRowSchema.omit({ done: true });

export const absenceRowSchema = z.object({
	id: z.string().min(1),
	lessonId: z.string().min(1),
	studentId: z.string().min(1)
});
