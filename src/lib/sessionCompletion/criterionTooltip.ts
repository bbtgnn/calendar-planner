import type { EnrichedLesson } from '$lib/lessonNotes/types';
import { screenshotFileNameForNote, screenshotPathLabel } from '$lib/lessonNotes/screenshot';
import { SESSION_CRITERIA } from './criteria';

export function criterionTooltip(lesson: EnrichedLesson, criterionId: string): string {
	const def = SESSION_CRITERIA.find((c) => c.id === criterionId);
	if (!def) return '';
	const status = lesson.criteria?.find((c) => c.id === criterionId);
	const state = status?.satisfied ? 'present' : 'missing';
	const stem = lesson.matchedNote
		? lesson.matchedNote.fileName.replace(/\.md$/i, '')
		: null;

	if (criterionId === 'note') {
		if (!lesson.matchedNote) return `${def.label}: missing (no note for this date)`;
		return `${def.label}: ${state} (${lesson.matchedNote.folder}/${lesson.matchedNote.fileName})`;
	}
	if (criterionId === 'screenshot') {
		if (!lesson.matchedNote) return `${def.label}: missing (no note for this date)`;
		const png = screenshotFileNameForNote(lesson.matchedNote.fileName);
		if (!png) return `${def.label}: missing`;
		return `${def.label}: ${state} (${screenshotPathLabel(lesson.matchedNote.folder, png)})`;
	}
	if (criterionId === 'attendance') {
		if (!stem) return `${def.label}: missing (no note stem)`;
		return `${def.label}: ${state} (presenze.csv column ${stem})`;
	}
	return `${def.label}: ${state}`;
}
