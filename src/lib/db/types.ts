export type ClassId = string;
export type StudentId = string;
export type LessonId = string;

export type LessonSessionKind = 'class' | 'extra';

export type ClassRow = {
	id: ClassId;
	name: string;
	totalHoursTarget: number;
	/** Student lesson hours required (50-minute units). */
	requiredStudentLessonHours: number;
	createdAt: number;
};

export type StudentRow = {
	id: StudentId;
	classId: ClassId;
	name: string;
};

export type LessonRow = {
	id: LessonId;
	classId: ClassId;
	date: string;
	durationHours: number;
	title: string;
	done: boolean;
	sessionKind: LessonSessionKind;
};

export type AbsenceRow = {
	id: string;
	lessonId: LessonId;
	studentId: StudentId;
};
