import { describe, expect, it } from 'vitest';
import { screenshotFileNameForNote, screenshotPathLabel } from './screenshot';

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
