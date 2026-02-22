import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	getOptionBoolean,
	getOptionString,
	getOptionStrings,
	type ParsedArgv,
} from "./argv";

export function requirePositional(
	value: string | undefined,
	name: string,
): string {
	if (!value) {
		throw new Error(`Missing required argument: ${name}`);
	}
	return value;
}

export function parseNumberOption(
	parsed: ParsedArgv,
	...names: string[]
): string | undefined {
	const value = getOptionString(parsed, ...names);
	if (!value) return undefined;
	const number = Number(value);
	if (Number.isNaN(number)) {
		throw new Error(`Expected numeric value for --${names[0]}`);
	}
	return String(number);
}

export async function readBodyInput(
	parsed: ParsedArgv,
	fallback: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
	const json = getOptionString(parsed, "data");
	if (json) {
		return asObject(JSON.parse(json));
	}

	const dataFile = getOptionString(parsed, "data-file", "dataFile");
	if (dataFile) {
		const raw = await readFile(dataFile, "utf8");
		return asObject(JSON.parse(raw));
	}

	const filtered = Object.fromEntries(
		Object.entries(fallback).filter(([, value]) => value !== undefined),
	);
	if (Object.keys(filtered).length > 0) {
		return filtered;
	}

	throw new Error(
		"Missing request body. Use --data '{...}' or --data-file <path>.",
	);
}

export function parseQueryCommon(parsed: ParsedArgv): Record<string, string> {
	const query: Record<string, string> = {};

	const limit = parseNumberOption(parsed, "limit");
	const offset = parseNumberOption(parsed, "offset");
	const search = getOptionString(parsed, "search");

	if (limit) query.limit = limit;
	if (offset) query.offset = offset;
	if (search) query.search = search;

	return query;
}

export function parseBooleanString(
	parsed: ParsedArgv,
	name: string,
): string | undefined {
	const value = getOptionString(parsed, name);
	if (!value) {
		if (getOptionBoolean(parsed, name)) return "true";
		return undefined;
	}

	const normalized = value.toLowerCase();
	if (["true", "false"].includes(normalized)) return normalized;
	throw new Error(`Invalid boolean for --${name}. Use true or false.`);
}

export function parseListStrings(parsed: ParsedArgv, name: string): string[] {
	return getOptionStrings(parsed, name)
		.map((value) => value.trim())
		.filter(Boolean);
}

export async function writeDownloadedFile(
	path: string,
	bytes: Uint8Array,
	force: boolean,
) {
	if (!force) {
		try {
			await readFile(path);
			throw new Error(
				`Refusing to overwrite ${path}. Use --force to overwrite.`,
			);
		} catch (error) {
			if (!(error instanceof Error) || !error.message.includes("ENOENT")) {
				throw error;
			}
		}
	}

	await writeFile(path, bytes);
}

export function defaultAttachmentPath(filename: string): string {
	return join(process.cwd(), filename);
}

function asObject(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Body must be a JSON object.");
	}
	return value as Record<string, unknown>;
}
