import { csvParseRows } from 'd3-dsv';

export function stripBom(text: string): string {
	return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseCsvGridRaw(text: string): string[][] {
	return csvParseRows(stripBom(text));
}
