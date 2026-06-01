import type { EnrichedLesson } from './types';
import { screenshotFileNameForNote, screenshotPathLabel } from './screenshot';

export function doneColumnTooltip(lesson: EnrichedLesson): string {
	if (lesson.sessionKind === 'skipped') return '';
	if (!lesson.matchedNote) return 'No note for this date';
	const png = screenshotFileNameForNote(lesson.matchedNote.fileName);
	if (!png) return 'No note for this date';
	return `Missing screenshot (expected ${screenshotPathLabel(lesson.matchedNote.folder, png)})`;
}
