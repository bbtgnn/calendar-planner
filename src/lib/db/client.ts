import Dexie, { type Table } from 'dexie';
import type { AbsenceRow, ClassRow, LessonRow, StudentRow } from './types';

export class LessonPlannerDB extends Dexie {
	classes!: Table<ClassRow, string>;
	students!: Table<StudentRow, string>;
	lessons!: Table<LessonRow, string>;
	absences!: Table<AbsenceRow, string>;

	constructor() {
		super('lesson-planner-db');
		this.version(1).stores({
			classes: 'id, name, createdAt',
			students: 'id, classId, name',
			lessons: 'id, classId, date, done',
			absences: 'id, lessonId, studentId'
		});
		this.version(2)
			.stores({
				classes: 'id, name, createdAt',
				students: 'id, classId, name',
				lessons: 'id, classId, date, done, sessionKind',
				absences: 'id, lessonId, studentId'
			})
			.upgrade(async (trans) => {
				await trans
					.table('classes')
					.toCollection()
					.modify((c: ClassRow) => {
						if (c.requiredStudentLessonHours === undefined) {
							c.requiredStudentLessonHours = 0;
						}
					});
				await trans
					.table('lessons')
					.toCollection()
					.modify((l: LessonRow) => {
						if (l.sessionKind === undefined) {
							l.sessionKind = 'class';
						}
					});
			});
	}
}

export const db = new LessonPlannerDB();
