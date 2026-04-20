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
	}
}

export const db = new LessonPlannerDB();
