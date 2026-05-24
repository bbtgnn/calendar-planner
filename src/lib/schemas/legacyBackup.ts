import { z } from 'zod';
import {
	absenceRowSchema,
	classRowSchema,
	lessonRowSchema,
	studentRowSchema
} from './rows';

export const legacyBackupSchema = z
	.object({
		classes: z.array(classRowSchema),
		students: z.array(studentRowSchema),
		lessons: z.array(lessonRowSchema),
		absences: z.array(absenceRowSchema)
	})
	.superRefine((data, ctx) => {
		const classIds = new Set(data.classes.map((c) => c.id));
		for (const [i, s] of data.students.entries()) {
			if (!classIds.has(s.classId)) {
				ctx.addIssue({
					code: 'custom',
					message: 'invalid classId reference',
					path: ['students', i, 'classId']
				});
			}
		}
		for (const [i, l] of data.lessons.entries()) {
			if (!classIds.has(l.classId)) {
				ctx.addIssue({
					code: 'custom',
					message: 'invalid classId reference',
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

export type LegacyBackup = z.infer<typeof legacyBackupSchema>;
