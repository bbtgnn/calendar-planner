import { describe, expect, it } from 'vitest';
import {
	screenshotFileNameForNote,
	screenshotFileNamesForNote,
	screenshotPathLabel
} from './screenshot';

describe('screenshotFileNameForNote', () => {
	it('maps 09.md to 09-screen.png', () => {
		expect(screenshotFileNameForNote('09.md')).toBe('09-screen.png');
	});

	it('rejects non-md names', () => {
		expect(screenshotFileNameForNote('09-screen.png')).toBeNull();
	});
});

describe('screenshotPathLabel', () => {
	it('joins folder and file', () => {
		expect(screenshotPathLabel('lezioni', '09-screen.png')).toBe('lezioni/09-screen.png');
	});
});

describe('screenshotFileNamesForNote', () => {
	it('returns primary only when one screen exists', () => {
		expect(screenshotFileNamesForNote('09.md', new Set(['09-screen.png']))).toEqual([
			'09-screen.png'
		]);
	});

	it('returns primary then numbered screens in order', () => {
		const set = new Set(['09-screen-3.png', '09-screen.png', '09-screen-2.png', '10-screen.png']);
		expect(screenshotFileNamesForNote('09.md', set)).toEqual([
			'09-screen.png',
			'09-screen-2.png',
			'09-screen-3.png'
		]);
	});

	it('returns numbered screens when primary is absent', () => {
		expect(screenshotFileNamesForNote('09.md', new Set(['09-screen-1.png', '09-screen-2.png']))).toEqual(
			['09-screen-1.png', '09-screen-2.png']
		);
	});

	it('returns empty for non-md note names', () => {
		expect(screenshotFileNamesForNote('09-screen.png', new Set(['09-screen.png']))).toEqual([]);
	});
});
