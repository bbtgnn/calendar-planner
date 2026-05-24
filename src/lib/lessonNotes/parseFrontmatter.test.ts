import { describe, expect, it } from 'vitest';
import { italianDateToIso, parseLessonNoteMarkdown } from './parseFrontmatter';

const SAMPLE = `---
data: 09/03/2026
durata: 4.5
---

- bullet
`;

describe('italianDateToIso', () => {
	it('converts DD/MM/YYYY to ISO', () => {
		expect(italianDateToIso('09/03/2026')).toBe('2026-03-09');
	});

	it('rejects invalid dates', () => {
		expect(italianDateToIso('9/3/2026')).toBeNull();
	});
});

describe('parseLessonNoteMarkdown', () => {
	it('parses Italian date and durata', () => {
		const r = parseLessonNoteMarkdown(SAMPLE, '01.md');
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.dateIso).toBe('2026-03-09');
			expect(r.durationHours).toBe(4.5);
		}
	});

	it('rejects missing data', () => {
		const r = parseLessonNoteMarkdown('---\ndurata: 1\n---\n', 'x.md');
		expect(r.ok).toBe(false);
	});
});
