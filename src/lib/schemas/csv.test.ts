import { describe, expect, it } from 'vitest';
import { parseCsvGrid } from './csv';

describe('parseCsvGrid', () => {
	it('parses simple grid', () => {
		const g = parseCsvGrid('a,b\n1,2');
		expect(g).toEqual([
			['a', 'b'],
			['1', '2']
		]);
	});

	it('handles quoted commas', () => {
		const g = parseCsvGrid('name,09\n"Rossi, Mario",P');
		expect(g[1][0]).toBe('Rossi, Mario');
		expect(g[1][1]).toBe('P');
	});

	it('strips UTF-8 BOM from first header', () => {
		const g = parseCsvGrid('\uFEFFname,09\nAlice,P');
		expect(g[0][0]).toBe('name');
	});
});
