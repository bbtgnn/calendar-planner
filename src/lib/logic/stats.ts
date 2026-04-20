import type { LessonSessionKind } from '$lib/db/types';

export const TEACHER_MINUTES_PER_TEACHER_HOUR = 60;
export const STUDENT_MINUTES_PER_STUDENT_HOUR = 50;

export type LessonForContractStats = {
	durationHours: number;
	done: boolean;
	sessionKind: LessonSessionKind;
};

/** @deprecated Prefer LessonForContractStats for new code */
export type LessonForStats = LessonForContractStats;

export function sumScheduledHours(lessons: Pick<LessonForContractStats, 'durationHours'>[]): number {
	return lessons.reduce((s, l) => s + l.durationHours, 0);
}

export function sumScheduledTeacherHours(lessons: LessonForContractStats[]): number {
	return lessons.reduce((s, l) => s + l.durationHours, 0);
}

export function remainingHours(totalHoursTarget: number, scheduledHours: number): number {
	return totalHoursTarget - scheduledHours;
}

/** Teacher hours → student hours (50-minute units). */
export function studentHoursFromTeacherHours(teacherHours: number): number {
	return teacherHours * (TEACHER_MINUTES_PER_TEACHER_HOUR / STUDENT_MINUTES_PER_STUDENT_HOUR);
}

/** M (student lesson hours) → minimum class teacher hours to cover M. */
export function minimumClassTeacherHoursForStudentLessonHours(studentLessonHours: number): number {
	return studentLessonHours * (STUDENT_MINUTES_PER_STUDENT_HOUR / TEACHER_MINUTES_PER_TEACHER_HOUR);
}

export function sumTeacherHoursForKind(
	lessons: LessonForContractStats[],
	kind: LessonSessionKind
): number {
	return lessons.filter((l) => l.sessionKind === kind).reduce((s, l) => s + l.durationHours, 0);
}

/** max(0, C_min − T_class) */
export function unplannedClassTeacherHours(
	requiredStudentLessonHours: number,
	classTeacherHoursScheduled: number
): number {
	const cMin = minimumClassTeacherHoursForStudentLessonHours(requiredStudentLessonHours);
	return Math.max(0, cMin - classTeacherHoursScheduled);
}

/** N − C_min (may be negative if contract cannot cover M). */
export function maxExtraTeacherHours(
	contractTeacherHours: number,
	requiredStudentLessonHours: number
): number {
	const cMin = minimumClassTeacherHoursForStudentLessonHours(requiredStudentLessonHours);
	return contractTeacherHours - cMin;
}

/**
 * Flex pool after "more class beyond C_min" and scheduled extra:
 * max(0, (N − C_min) − max(0, T_class − C_min) − T_extra)
 */
export function remainingFlexTeacherHours(
	contractTeacherHours: number,
	requiredStudentLessonHours: number,
	classTeacherHoursScheduled: number,
	extraTeacherHoursScheduled: number
): number {
	const cMin = minimumClassTeacherHoursForStudentLessonHours(requiredStudentLessonHours);
	const pool = contractTeacherHours - cMin;
	const beyondClass = Math.max(0, classTeacherHoursScheduled - cMin);
	return Math.max(0, pool - beyondClass - extraTeacherHoursScheduled);
}

/** N − T_class − T_extra */
export function totalUnscheduledContractTeacherHours(
	contractTeacherHours: number,
	classTeacherHoursScheduled: number,
	extraTeacherHoursScheduled: number
): number {
	return contractTeacherHours - classTeacherHoursScheduled - extraTeacherHoursScheduled;
}

export function scheduledClassLessonCount(lessons: LessonForContractStats[]): number {
	return lessons.filter((l) => l.sessionKind === 'class').length;
}

export function doneClassLessonCount(lessons: LessonForContractStats[]): number {
	return lessons.filter((l) => l.sessionKind === 'class' && l.done).length;
}

export function scheduledExtraSessionCount(lessons: LessonForContractStats[]): number {
	return lessons.filter((l) => l.sessionKind === 'extra').length;
}

export function doneExtraSessionCount(lessons: LessonForContractStats[]): number {
	return lessons.filter((l) => l.sessionKind === 'extra' && l.done).length;
}

/** Student hours (50-minute) implied by scheduled class teacher hours. */
export function studentLessonHoursDeliveredFromClass(classTeacherHoursScheduled: number): number {
	return studentHoursFromTeacherHours(classTeacherHoursScheduled);
}

/** Class sessions only (per contract spec). */
export function scheduledLessonCount(lessons: LessonForContractStats[]): number {
	return scheduledClassLessonCount(lessons);
}

/** Class sessions only (per contract spec). */
export function doneLessonCount(lessons: LessonForContractStats[]): number {
	return doneClassLessonCount(lessons);
}
