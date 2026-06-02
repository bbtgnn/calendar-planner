import { z } from 'zod';
import {
	absenceRowSchema,
	classRowSchema,
	persistedLessonRowSchema,
	studentRowSchema
} from './rows';

export const plannerFileSchema = z
	.object({
		version: z.literal(1),
		class: classRowSchema,
		students: z.array(studentRowSchema),
		lessons: z.array(persistedLessonRowSchema),
		absences: z.array(absenceRowSchema)
	})
	.superRefine((data, ctx) => {
		const classId = data.class.id;
		for (const [i, s] of data.students.entries()) {
			if (s.classId !== classId) {
				ctx.addIssue({
					code: 'custom',
					message: 'student classId mismatch',
					path: ['students', i, 'classId']
				});
			}
		}
		for (const [i, l] of data.lessons.entries()) {
			if (l.classId !== classId) {
				ctx.addIssue({
					code: 'custom',
					message: 'lesson classId mismatch',
					path: ['lessons', i, 'classId']
				});
			}
		}
		const lessonIds = new Set(data.lessons.map((l) => l.id));
		const studentIds = new Set(data.students.map((s) => s.id));
		for (const [i, a] of data.absences.entries()) {
			if (!lessonIds.has(a.lessonId) || !studentIds.has(a.studentId)) {
				ctx.addIssue({
					code: 'custom',
					message: 'invalid absence reference',
					path: ['absences', i]
				});
			}
		}
	});

export type PlannerFileV1 = z.infer<typeof plannerFileSchema>;
