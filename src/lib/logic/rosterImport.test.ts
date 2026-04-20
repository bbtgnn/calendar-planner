import { describe, expect, it } from 'vitest';
import { parseCsvNames, parseTxtNames } from './rosterImport';

describe('rosterImport', () => {
	it('parseTxtNames trims and drops empties', () => {
		const r = parseTxtNames('  a \n\nb\r\nc');
		expect(r.names).toEqual(['a', 'b', 'c']);
		expect(r.skipped).toBe(0);
	});

	it('parseCsvNames uses first column; header name', () => {
		const r = parseCsvNames('name,note\nAlice,x\nBob,y');
		expect(r.names).toEqual(['Alice', 'Bob']);
		expect(r.skipped).toBe(0);
	});

	it('parseCsvNames without header uses first column', () => {
		const r = parseCsvNames('Zoe,extra\n');
		expect(r.names).toEqual(['Zoe']);
	});

	it('parseCsvNames skips empty first cells', () => {
		const r = parseCsvNames('Alice\n,');
		expect(r.names).toEqual(['Alice']);
		expect(r.skipped).toBe(1);
	});
});
