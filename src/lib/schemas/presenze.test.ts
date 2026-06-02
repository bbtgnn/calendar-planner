import { describe, expect, it } from 'vitest';
import { buildPresenzeStemIndex, loadPresenzeStemIndex } from './presenze';

describe('buildPresenzeStemIndex', () => {
	it('marks stem true when column has a non-empty cell', () => {
		const map = buildPresenzeStemIndex([
			['name', '09', '10'],
			['Alice', 'P', ''],
			['Bob', '', '']
		]);
		expect(map.get('09')).toBe(true);
		expect(map.get('10')).toBe(false);
	});

	it('ignores column 0 as student names', () => {
		const map = buildPresenzeStemIndex([
			['name', '09'],
			['Alice', 'P']
		]);
		expect(map.has('name')).toBe(false);
		expect(map.get('09')).toBe(true);
	});
});

describe('loadPresenzeStemIndex', () => {
	it('returns empty map for invalid csv', () => {
		expect(loadPresenzeStemIndex('').size).toBe(0);
	});
});
