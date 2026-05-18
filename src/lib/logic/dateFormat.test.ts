import { describe, expect, it } from 'vitest';
import { formatIsoDate, formatYearMonthHeading } from './dateFormat';

describe('formatIsoDate', () => {
	it('formats YYYY-MM-DD as dd/MM/yyyy', () => {
		expect(formatIsoDate('2026-04-07')).toBe('07/04/2026');
		expect(formatIsoDate('2026-01-01')).toBe('01/01/2026');
	});

	it('returns input unchanged when not ISO-shaped', () => {
		expect(formatIsoDate('not-a-date')).toBe('not-a-date');
	});
});

describe('formatYearMonthHeading', () => {
	it('uses long month name in en-GB', () => {
		expect(formatYearMonthHeading('2026-04')).toBe('April 2026');
	});
});
