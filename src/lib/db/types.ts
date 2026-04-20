export type ClassId = string;
export type StudentId = string;
export type LessonId = string;

export type ClassRow = {
	id: ClassId;
	name: string;
	totalHoursTarget: number;
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
};

export type AbsenceRow = {
	id: string;
	lessonId: LessonId;
	studentId: StudentId;
};
