import type { LessonSessionKind } from '$lib/db/types';

export const TEACHER_MINUTES_PER_TEACHER_HOUR = 60;
export const STUDENT_MINUTES_PER_STUDENT_HOUR = 50;

export type LessonForContractStats = {
	durationHours: number;
	done: boolean;
	sessionKind: LessonSessionKind;
};

/** Alias for docs / older references — same shape as `LessonForContractStats`. */
export type LessonForStats = LessonForContractStats;

function sumDurationHours(lessons: { durationHours: number }[]): number {
	return lessons.reduce((s, l) => s + l.durationHours, 0);
}

export function sumScheduledHours(lessons: Pick<LessonForContractStats, 'durationHours'>[]): number {
	return sumDurationHours(lessons);
}

export function sumScheduledTeacherHours(lessons: LessonForContractStats[]): number {
	return sumDurationHours(lessons);
}

/** Sum of `durationHours` for done class and extra sessions (skipped excluded). */
export function sumDoneTeacherHours(lessons: LessonForContractStats[]): number {
	return sumDurationHours(
		lessons.filter((l) => l.done && l.sessionKind !== 'skipped')
	);
}

export function sumDoneTeacherHoursForKind(
	lessons: LessonForContractStats[],
	kind: LessonSessionKind
): number {
	return sumDurationHours(
		lessons.filter((l) => l.done && l.sessionKind === kind)
	);
}

/** Done teacher hours as a percent of contract N (0–100). */
export function contractCompletionPercent(
	contractTeacherHours: number,
	lessons: LessonForContractStats[]
): number {
	if (contractTeacherHours <= 0) return 0;
	const done = sumDoneTeacherHours(lessons);
	return Math.min(100, Math.round((done / contractTeacherHours) * 100));
}

/** Scheduled teacher hours as a percent of contract N (may exceed 100 if overscheduled). */
export function contractScheduledFillPercent(
	contractTeacherHours: number,
	scheduledTeacherHours: number
): number {
	if (contractTeacherHours <= 0) return scheduledTeacherHours > 0 ? 100 : 0;
	return Math.round((scheduledTeacherHours / contractTeacherHours) * 100);
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
	return sumDurationHours(lessons.filter((l) => l.sessionKind === kind));
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

/** Effective extra hour cap after class overage beyond C_min. */
export function effectiveExtraTeacherHourCap(
	contractTeacherHours: number,
	requiredStudentLessonHours: number,
	classTeacherHoursScheduled: number
): number {
	const cMin = minimumClassTeacherHoursForStudentLessonHours(requiredStudentLessonHours);
	const beyond = Math.max(0, classTeacherHoursScheduled - cMin);
	const pool = contractTeacherHours - cMin;
	return Math.max(0, pool - beyond);
}

export type HourProgressRowKey = 'contract' | 'class' | 'extra' | 'student';

export type HourProgressRow = {
	key: HourProgressRowKey;
	label: string;
	contract: number | null;
	planned: number;
	done: number;
	warning?: string;
};

export function buildHourProgressRows(
	contractTeacherHours: number,
	requiredStudentLessonHours: number,
	lessons: LessonForContractStats[]
): HourProgressRow[] {
	const tClass = sumTeacherHoursForKind(lessons, 'class');
	const tExtra = sumTeacherHoursForKind(lessons, 'extra');
	const tAll = tClass + tExtra;
	const doneClass = sumDoneTeacherHoursForKind(lessons, 'class');
	const doneExtra = sumDoneTeacherHoursForKind(lessons, 'extra');
	const doneAll = doneClass + doneExtra;
	const cMin = minimumClassTeacherHoursForStudentLessonHours(requiredStudentLessonHours);
	const extraCap = effectiveExtraTeacherHourCap(
		contractTeacherHours,
		requiredStudentLessonHours,
		tClass
	);
	const staticExtraPool = maxExtraTeacherHours(contractTeacherHours, requiredStudentLessonHours);
	const extraWarning =
		staticExtraPool < 0
			? 'Contract N is below the minimum teacher hours needed for M — raise N or lower M.'
			: undefined;

	return [
		{
			key: 'contract',
			label: 'Contract (60 min)',
			contract: contractTeacherHours > 0 ? contractTeacherHours : null,
			planned: tAll,
			done: doneAll
		},
		{
			key: 'class',
			label: 'Class (60 min)',
			contract: cMin,
			planned: tClass,
			done: doneClass
		},
		{
			key: 'extra',
			label: 'Extra (60 min)',
			contract: extraCap,
			planned: tExtra,
			done: doneExtra,
			warning: extraWarning
		},
		{
			key: 'student',
			label: 'Student (50 min)',
			contract: requiredStudentLessonHours,
			planned: studentHoursFromTeacherHours(tClass),
			done: studentHoursFromTeacherHours(doneClass)
		}
	];
}
