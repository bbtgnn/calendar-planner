import { describe, expect, it } from 'vitest';
import {
	attendanceVisibleForKind,
	doneEditableForKind,
	hoursEditableForKind,
	labelForTitleField,
	normalizedHoursForKind
} from './sessionKindUi';

describe('sessionKindUi', () => {
	it('forces skipped hours to zero', () => {
		expect(normalizedHoursForKind('skipped', 2)).toBe(0);
		expect(normalizedHoursForKind('class', 2)).toBe(2);
	});

	it('marks skipped title label as reason', () => {
		expect(labelForTitleField('skipped')).toBe('Reason');
		expect(labelForTitleField('class')).toBe('Title');
	});

	it('disables hours and done for skipped', () => {
		expect(hoursEditableForKind('skipped')).toBe(false);
		expect(doneEditableForKind('skipped')).toBe(false);
		expect(hoursEditableForKind('extra')).toBe(true);
	});

	it('hides attendance for non-class kinds', () => {
		expect(attendanceVisibleForKind('class')).toBe(true);
		expect(attendanceVisibleForKind('extra')).toBe(false);
		expect(attendanceVisibleForKind('skipped')).toBe(false);
	});
});
