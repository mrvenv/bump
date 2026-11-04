/**
 * JSON files that keep their original indentation, line endings and trailing
 * newline, so a rewrite only changes the edited values in the diff.
 */

export interface JsonFormat {
	indent: string;
	eol: string;
	finalNewline: boolean;
}

export interface JsonFile<T> {
	path: string;
	data: T;
	format: JsonFormat;
}

const BOM = "﻿";
const DEFAULT_INDENT = "  ";

const stripBom = (text: string) =>
	text.startsWith(BOM) ? text.slice(BOM.length) : text;

const leadingWhitespace = (line: string) =>
	line.slice(0, line.length - line.trimStart().length);

function detectFormat(text: string): JsonFormat {
	const secondLine = text.split("\n", 2)[1] ?? "";
	return {
		indent: leadingWhitespace(secondLine) || DEFAULT_INDENT,
		eol: text.includes("\r\n") ? "\r\n" : "\n",
		finalNewline: text.endsWith("\n"),
	};
}

function parseJson<T>(text: string, path: string): T {
	try {
		return JSON.parse(text);
	} catch (err) {
		throw new Error(`Failed to parse ${path}: ${(err as Error).message}`, {
			cause: err,
		});
	}
}

function stringifyJson(
	data: unknown,
	{ indent, eol, finalNewline }: JsonFormat,
): string {
	const text = JSON.stringify(data, null, indent);
	const withEol = eol === "\n" ? text : text.replaceAll("\n", eol);
	return finalNewline ? withEol + eol : withEol;
}

export async function readJsonFile<T>(path: string): Promise<JsonFile<T>> {
	const file = Bun.file(path);
	if (!(await file.exists())) throw new Error(`File not found: ${path}`);
	const text = stripBom(await file.text());
	return { path, data: parseJson<T>(text, path), format: detectFormat(text) };
}

export async function writeJsonFile<T>({
	path,
	data,
	format,
}: JsonFile<T>): Promise<void> {
	await Bun.write(path, stringifyJson(data, format));
}
