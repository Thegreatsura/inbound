export type ParsedArgv = {
	positionals: string[];
	options: Record<string, string | string[] | boolean>;
};

function addOption(
	options: Record<string, string | string[] | boolean>,
	key: string,
	value: string | boolean,
) {
	const existing = options[key];

	if (existing === undefined) {
		options[key] = value;
		return;
	}

	if (Array.isArray(existing)) {
		existing.push(String(value));
		return;
	}

	options[key] = [String(existing), String(value)];
}

export function parseArgv(argv: string[]): ParsedArgv {
	const positionals: string[] = [];
	const options: Record<string, string | string[] | boolean> = {};

	for (let i = 0; i < argv.length; i++) {
		const token = argv[i];

		if (token === "--") {
			positionals.push(...argv.slice(i + 1));
			break;
		}

		if (token.startsWith("--")) {
			const trimmed = token.slice(2);
			const equalsIndex = trimmed.indexOf("=");

			if (equalsIndex >= 0) {
				const key = trimmed.slice(0, equalsIndex);
				const value = trimmed.slice(equalsIndex + 1);
				addOption(options, key, value);
				continue;
			}

			const key = trimmed;
			const next = argv[i + 1];
			if (next !== undefined && !next.startsWith("-")) {
				addOption(options, key, next);
				i += 1;
			} else {
				addOption(options, key, true);
			}
			continue;
		}

		if (token.startsWith("-") && token.length > 1) {
			const shortFlags = token.slice(1).split("");
			for (const short of shortFlags) {
				if (short === "j") {
					addOption(options, "json", true);
				} else if (short === "d") {
					addOption(options, "debug", true);
				} else {
					addOption(options, short, true);
				}
			}
			continue;
		}

		positionals.push(token);
	}

	return { positionals, options };
}

export function getOption(
	parsed: ParsedArgv,
	...names: string[]
): string | boolean | string[] | undefined {
	for (const name of names) {
		const value = parsed.options[name];
		if (value !== undefined) {
			return value;
		}
	}
	return undefined;
}

export function getOptionString(
	parsed: ParsedArgv,
	...names: string[]
): string | undefined {
	const value = getOption(parsed, ...names);
	if (Array.isArray(value)) return value[value.length - 1];
	if (typeof value === "boolean") return undefined;
	return value;
}

export function getOptionStrings(
	parsed: ParsedArgv,
	...names: string[]
): string[] {
	const value = getOption(parsed, ...names);
	if (value === undefined || value === false) return [];
	if (value === true) return [];
	return Array.isArray(value) ? value : [value];
}

export function getOptionBoolean(
	parsed: ParsedArgv,
	...names: string[]
): boolean {
	const value = getOption(parsed, ...names);
	if (typeof value === "boolean") return value;
	if (Array.isArray(value)) {
		const last = value[value.length - 1];
		return ["1", "true", "yes", "on"].includes(last.toLowerCase());
	}
	if (typeof value === "string") {
		return ["1", "true", "yes", "on"].includes(value.toLowerCase());
	}
	return false;
}
